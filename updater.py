"""GitHub Releases updater. Only HTTPS github.com API and release assets."""
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import threading
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from tkinter import messagebox, simpledialog

VERSION = '10.1.0'
API = 'https://api.github.com/repos/{}/releases/latest'
MAX_INSTALLER_BYTES = 250 * 1024 * 1024


def parse_repo(value):
    value = (value or '').strip().rstrip('/')
    value = re.sub(r'^https://github\.com/', '', value, flags=re.I)
    value = re.sub(r'\.git$', '', value, flags=re.I)
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', value):
        raise ValueError('Informe o repositório no formato usuario/repositorio.')
    return value


def version_tuple(value):
    value = str(value).strip().lstrip('vV')
    if not re.fullmatch(r'\d+(?:\.\d+){0,3}', value):
        raise ValueError('Versão inválida: ' + value)
    return tuple(map(int, value.split('.')))


def newer(remote, local=VERSION):
    a, b = version_tuple(remote), version_tuple(local)
    size = max(len(a), len(b))
    return a + (0,) * (size - len(a)) > b + (0,) * (size - len(b))


def github_request(url, timeout=15):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'PEAK-Dashboard-Updater/' + VERSION,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    })
    return urllib.request.urlopen(req, timeout=timeout)


def latest_release(repo):
    repo = parse_repo(repo)
    with github_request(API.format(repo)) as response:
        data = json.load(response)
    tag = data.get('tag_name', '')
    if not newer(tag):
        return None
    assets = data.get('assets') or []
    exe = next((x for x in assets if x.get('name') in ('PEAK_Dashboard_V10_1_Setup.exe','PEAK_Dashboard_Setup.exe')), None)
    digest = next((x for x in assets if x.get('name') in ('PEAK_Dashboard_V10_1_Setup.exe.sha256','PEAK_Dashboard_Setup.exe.sha256')), None)
    if not exe or not digest:
        raise ValueError('A versão nova precisa incluir o instalador EXE e seu arquivo .sha256.')
    for asset in (exe, digest):
        url = asset.get('browser_download_url', '')
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != 'https' or parsed.hostname != 'github.com':
            raise ValueError('Endereço do arquivo de atualização não é confiável.')
    return {'tag': tag, 'notes': data.get('body') or 'Sem notas de versão.',
            'exe': exe['browser_download_url'], 'sha': digest['browser_download_url']}


def download_and_verify(release):
    directory = Path(tempfile.mkdtemp(prefix='peak_update_'))
    target = directory / 'PEAK_Dashboard_V10_1_Setup.exe'
    with github_request(release['sha']) as response:
        checksum_text = response.read(4096).decode('utf-8', errors='replace').strip()
    match = re.search(r'\b[a-fA-F0-9]{64}\b', checksum_text)
    if not match:
        raise ValueError('Arquivo SHA-256 inválido.')
    expected = match.group(0).lower()
    digest = hashlib.sha256()
    total = 0
    with github_request(release['exe'], timeout=40) as response, target.open('wb') as out:
        while True:
            block = response.read(1024 * 1024)
            if not block:
                break
            total += len(block)
            if total > MAX_INSTALLER_BYTES:
                raise ValueError('O instalador excedeu o limite de 250 MB.')
            digest.update(block)
            out.write(block)
    if not total or digest.hexdigest() != expected:
        target.unlink(missing_ok=True)
        raise ValueError('A verificação SHA-256 falhou. Atualização cancelada.')
    return target


class UpdateController:
    def __init__(self, app):
        self.app = app
        self.running = False

    def configure(self):
        current = self.app.cfg.get('github_repo', 'micaelchines0-rgb/PEAK-Dashboard')
        value = simpledialog.askstring('Atualizações PEAK',
            'Repositório público do GitHub (usuario/repositorio):',
            initialvalue=current, parent=self.app)
        if value is None:
            return
        try:
            repo = parse_repo(value)
        except ValueError as exc:
            messagebox.showerror('Repositório inválido', str(exc), parent=self.app)
            return
        self.app.cfg['github_repo'] = repo
        self.app.save_app_config()
        messagebox.showinfo('Atualizações', 'Repositório configurado. Buscando atualizações...', parent=self.app)
        self.check(manual=True)

    def check(self, manual=False):
        repo = self.app.cfg.get('github_repo', '')
        if not repo:
            if manual:
                self.configure()
            return
        if self.running:
            return
        self.running = True
        def work():
            try:
                result = latest_release(repo)
                self.app.after(0, lambda: self._result(result, manual))
            except Exception as exc:
                msg = str(exc)
                self.app.after(0, lambda: self._error(msg, manual))
        threading.Thread(target=work, daemon=True).start()

    def _error(self, msg, manual):
        self.running = False
        if manual:
            messagebox.showwarning('Atualizações PEAK', 'Não foi possível verificar as atualizações.\n' + msg, parent=self.app)

    def _result(self, release, manual):
        self.running = False
        if not release:
            if manual:
                messagebox.showinfo('Atualizações PEAK', 'Você já está usando a versão mais recente.', parent=self.app)
            return
        notes = release['notes'][:1200]
        confirm = messagebox.askyesno('Atualização PEAK disponível',
            f'Nova versão: {release["tag"]}\nVersão atual: {VERSION}\n\nNovidades:\n{notes}\n\nDeseja baixar e instalar agora?',
            parent=self.app)
        if confirm:
            self._install(release)

    def _install(self, release):
        if sys.platform != 'win32':
            messagebox.showinfo('Atualização', 'A instalação automática é destinada ao Windows.', parent=self.app)
            return
        self.running = True
        def work():
            try:
                path = download_and_verify(release)
                self.app.after(0, lambda: self._launch(path))
            except Exception as exc:
                msg = str(exc)
                self.app.after(0, lambda: self._error(msg, True))
        threading.Thread(target=work, daemon=True).start()

    def _launch(self, path):
        self.running = False
        if not messagebox.askyesno('Instalar atualização',
            'Download concluído e integridade verificada.\n\nFechar a PEAK Dashboard e abrir o instalador?', parent=self.app):
            return
        try:
            subprocess.Popen([str(path)], cwd=str(path.parent), close_fds=True)
            self.app.close()
        except Exception as exc:
            messagebox.showerror('Instalador', str(exc), parent=self.app)
