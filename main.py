import os, sys, sqlite3, random, json, shutil, subprocess, datetime, tkinter as tk
from tkinter import ttk, messagebox, filedialog
from pathlib import Path
from updater import UpdateController, VERSION

APP_DIR=Path(os.getenv("APPDATA") or (Path.home()/".local/share"))/"PEAK_Dashboard"
APP_DIR.mkdir(parents=True,exist_ok=True)
DB=APP_DIR/"peak.sqlite3"
SETTINGS=APP_DIR/"settings.json"
BG="#0b0b10"; PANEL="#15151d"; FIELD="#0d0d14"; FG="#f3f1fb"; MUTED="#9b9ab3"; BLUE="#428dff"; GREEN="#00d98a"; RED="#ff697b"; PURPLE="#a66aff"; GOLD="#ffba38"; FONT="Trebuchet MS"
def money(v): return f"R$ {v:,.2f}".replace(",","X").replace(".",",").replace("X",".")
def num(s):
    s=str(s).strip().replace("R$","").replace(" ","")
    if "," in s: s=s.replace(".","").replace(",",".")
    return float(s or 0)
def db():
    c=sqlite3.connect(DB)
    c.execute("""CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,
        created TEXT NOT NULL, client TEXT NOT NULL, phone TEXT, link TEXT,
        deposit REAL NOT NULL, withdrawal REAL NOT NULL, blogger REAL NOT NULL)""")
    c.execute("CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY,v TEXT)")
    c.commit();return c
def settings():
    try:return json.loads(SETTINGS.read_text(encoding="utf-8"))
    except:return {}
def save_settings(d): SETTINGS.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding="utf-8")
class Peak(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(f"PEAK Dashboard V{VERSION} — Midnight Black")
        self.geometry("1370x840");self.minsize(940,620);self.configure(bg=BG)
        try:
            self.iconbitmap(str(Path(getattr(sys,"_MEIPASS",Path(__file__).parent))/"PEAK.ico"))
        except Exception: pass
        self.conn=db();self.cfg=settings();self.inputs={}
        self.style=ttk.Style(self);self.style.theme_use("clam")
        self.style.configure("Treeview",background=FIELD,foreground=FG,fieldbackground=FIELD,rowheight=34,borderwidth=0,font=(FONT,10))
        self.style.configure("Treeview.Heading",background="#23212e",foreground="#d8d1f5",relief="flat",font=(FONT,10,"bold"))
        self.style.map("Treeview",background=[("selected","#383051")])
        self.style.configure("TPanedwindow",background=BG)
        self.make_ui();self.refresh()
        self.updater = UpdateController(self)
        self.after(1500, lambda: self.updater.check(manual=False))
        self.protocol("WM_DELETE_WINDOW",self.close)
    def label(self,parent,text,color=FG,size=10,bold=False,**kw):
        return tk.Label(parent,text=text,bg=parent.cget("bg"),fg=color,font=(FONT,size,"bold" if bold else "normal"),**kw)
    def frame(self,parent,pad=10):
        f=tk.Frame(parent,bg=PANEL,highlightbackground="#302c3b",highlightthickness=1)
        return f
    def btn(self,p,text,cmd,accent=False):
        return tk.Button(p,text=text,command=cmd,bg="#5b3fcb" if accent else "#272432",fg="white",activebackground="#795cf0",activeforeground="white",bd=0,padx=10,pady=6,font=(FONT,9,"bold"),cursor="hand2")
    def entry(self,p,width=12):
        return tk.Entry(p,bg=FIELD,fg=FG,insertbackground=FG,relief="flat",highlightbackground="#393346",highlightthickness=1,font=(FONT,10),width=width)
    def heading(self,p,title,color=BLUE):
        self.label(p,title,color,11,True).pack(anchor="w",padx=10,pady=(8,7))
    def make_ui(self):
        head=tk.Frame(self,bg="#111019",height=54);head.pack(fill="x");head.pack_propagate(False)
        self.label(head,"▲  PEAK",PURPLE,13,True).pack(side="left",padx=(16,13))
        self.label(head,"Grupo das Blogueiras  ·  Controle financeiro",FG,11,True).pack(side="left")
        self.clock=self.label(head,"",MUTED,9);self.clock.pack(side="right",padx=16);self.tick()
        toolbar=tk.Frame(self,bg=BG);toolbar.pack(fill="x",padx=10,pady=8)
        self.btn(toolbar,"🎲",self.generator,True).pack(side="left")
        self.btn(toolbar,"↻  Atualizações",lambda:self.updater.check(manual=True)).pack(side="left",padx=6)
        self.btn(toolbar,"⚙  GitHub",lambda:self.updater.configure()).pack(side="left")
        self.btn(toolbar,"Fechamento diário (Excel)",self.closing).pack(side="right")
        self.btn(toolbar,"▣  Dados",self.open_folder).pack(side="right",padx=6)
        self.split=ttk.Panedwindow(self,orient="horizontal");self.split.pack(fill="both",expand=True,padx=10,pady=(0,10))
        self.left=tk.Frame(self.split,bg=BG);self.right=tk.Frame(self.split,bg=BG)
        self.split.add(self.left,weight=2);self.split.add(self.right,weight=5)
        self.after(180,lambda:self.restore_split())
        self.notes_panel=self.frame(self.left);self.notes_panel.pack(fill="x",pady=(0,8))
        bar=tk.Frame(self.notes_panel,bg=PANEL);bar.pack(fill="x",padx=10,pady=(7,3))
        self.label(bar,"▤  Bloco de Notas",PURPLE,10,True).pack(side="left")
        self.btn(bar,"Limpar",lambda:(self.notes.delete("1.0","end"),self.save_note())).pack(side="right")
        self.notes=tk.Text(self.notes_panel,height=5,bg=FIELD,fg=FG,insertbackground=FG,relief="flat",font=(FONT,10),wrap="word",undo=True)
        self.notes.pack(fill="x",padx=10,pady=(0,9))
        self.notes.insert("1.0",self.getmeta("notes"))
        self.notes.bind("<KeyRelease>",lambda e:self.save_note())
        # Drag only the bottom edge of the notes panel, vertically.
        grip=tk.Frame(self.notes_panel,height=6,bg="#252c36",cursor="sb_v_double_arrow")
        grip.pack(fill="x",side="bottom")
        grip.bind("<Button-1>",lambda e:setattr(self,"note_drag_y",e.y_root))
        grip.bind("<B1-Motion>",self.resize_notes)
        calc=self.frame(self.left);calc.pack(fill="x",pady=(0,8))
        self.heading(calc,"▦  Calculadora de Soma",PURPLE)
        pair=tk.Frame(calc,bg=PANEL);pair.pack(fill="x",padx=10)
        self.calc_fields=[]
        for col,title in enumerate(("Depósitos","Saques")):
            cell=tk.Frame(pair,bg=PANEL);cell.grid(row=0,column=col,sticky="nsew",padx=(0,5) if col==0 else (5,0))
            self.label(cell,title,MUTED,9).pack(anchor="w")
            a=self.entry(cell);a.pack(fill="x",pady=3);b=self.entry(cell);b.pack(fill="x",pady=3)
            total=self.label(cell,"R$ 0,00",BLUE,9,True);total.pack(anchor="w",pady=4)
            self.calc_fields.append((a,b,total))
            for w in (a,b):w.bind("<KeyRelease>",lambda e:self.calc_update())
        self.btn(calc,"Limpar tudo",self.calc_clear).pack(anchor="e",padx=10,pady=7)
        pair.grid_columnconfigure(0,weight=1);pair.grid_columnconfigure(1,weight=1)
        form=self.frame(self.left);form.pack(fill="both",expand=True)
        self.heading(form,"＋  Nova Operação · Site",PURPLE)
        fields=[("deposit","Depósito (Saída) — R$"),("withdrawal","Saque (Entrada) — R$"),("blogger","Blogueira (Valor pago) — R$"),("client","Nome da cliente"),("phone","Telefone da cliente"),("link","Link da conta")]
        for key,title in fields:
            self.label(form,title,MUTED,9).pack(anchor="w",padx=10,pady=(4,0))
            e=self.entry(form);e.pack(fill="x",padx=10,pady=(2,1));self.inputs[key]=e
        self.btn(form,"Salvar operação",self.add_order,True).pack(fill="x",padx=10,pady=10)
        # Right-side price entry and records
        top=self.frame(self.right);top.pack(fill="x",pady=(0,8))
        cats=tk.Frame(top,bg=PANEL);cats.pack(fill="x",padx=10,pady=6)
        self.groups={}
        for group,types,color in (("Dragão",["D5","D7","D9","D11"],GREEN),("Pinguim",["P6","P8"],BLUE)):
            f=tk.Frame(cats,bg=PANEL);f.pack(side="left",fill="x",expand=True,padx=6)
            self.label(f,("🐉  " if group=="Dragão" else "🐧  ")+group,color,11,True).pack(anchor="center",pady=3)
            cells=tk.Frame(f,bg=PANEL);cells.pack(anchor="center")
            for t in types:
                e=self.entry(cells,5);e.pack(side="left",padx=3,pady=4);e.insert(0,"")
                e.bind("<KeyRelease>",lambda ev:self.update_prices())
                self.groups[t]=e
                self.label(cells,t,MUTED,8).pack(side="left",padx=(0,5))
        row=tk.Frame(top,bg=PANEL);row.pack(fill="x",padx=14,pady=(2,10))
        self.label(row,"Sigla:",MUTED,9).pack(side="left")
        self.sigla=self.entry(row,12);self.sigla.pack(side="left",padx=6)
        self.price_total=self.label(row,"R$ 0,00",GREEN,13,True);self.price_total.pack(side="left",padx=12)
        self.btn(row,"▢",self.copy_pix,True).pack(side="right")
        records=self.frame(self.right);records.pack(fill="both",expand=True)
        self.heading(records,"☷  Pedidos registrados · Financeiro",PURPLE)
        summary=tk.Frame(records,bg=PANEL);summary.pack(fill="x",padx=10,pady=5)
        self.totals={}
        for name in ("Depósitos","Saques","Blogueira","Lucro líquido"):
            c=tk.Frame(summary,bg=FIELD,highlightbackground="#343044",highlightthickness=1)
            c.pack(side="left",fill="x",expand=True,padx=3)
            self.label(c,name,PURPLE if name=="Blogueira" else GOLD if name=="Saques" else GREEN if name=="Lucro líquido" else BLUE,9).pack(anchor="w",padx=8,pady=(6,1))
            v=self.label(c,"R$ 0,00",BLUE,12,True);v.pack(anchor="w",padx=8,pady=(0,7))
            self.totals[name]=v
            if name=="Blogueira": v.configure(fg=PURPLE)
            if name=="Saques": v.configure(fg=GOLD)
        wrap=tk.Frame(records,bg=PANEL);wrap.pack(fill="both",expand=True,padx=10,pady=9)
        cols=("client","link","deposit","withdrawal","blogger","profit")
        self.table=ttk.Treeview(wrap,columns=cols,show="headings",selectmode="browse")
        for k,title,width in zip(cols,("Nome da cliente","Link da conta","Depósito","Saque","Blogueira","Lucro líquido"),(145,170,95,95,95,110)):
            self.table.heading(k,text=title);self.table.column(k,width=width,minwidth=75,stretch=True)
        self.table.tag_configure("negative",foreground=RED);self.table.tag_configure("positive",foreground=GREEN)
        self.table.pack(side="left",fill="both",expand=True)
        scroll=ttk.Scrollbar(wrap,orient="vertical",command=self.table.yview);scroll.pack(side="right",fill="y")
        self.table.configure(yscrollcommand=scroll.set)
        actions=tk.Frame(records,bg=PANEL);actions.pack(fill="x",padx=10,pady=(0,10))
        self.btn(actions,"Editar selecionado",self.edit_selected).pack(side="left")
        self.btn(actions,"Excluir selecionado",self.delete_selected).pack(side="left",padx=6)
        self.label(actions,"Telefone e data são salvos no Excel.",MUTED,9).pack(side="right")
    def tick(self):
        self.clock.config(text=datetime.datetime.now().strftime("%d/%m/%Y  %H:%M"))
        self.after(30000,self.tick)
    def save_app_config(self):
        save_settings(self.cfg)
    def getmeta(self,k):
        r=self.conn.execute("SELECT v FROM meta WHERE k=?",(k,)).fetchone()
        return r[0] if r else ""
    def setmeta(self,k,v):
        self.conn.execute("INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",(k,v));self.conn.commit()
    def save_note(self):self.setmeta("notes",self.notes.get("1.0","end-1c"))
    def resize_notes(self,e):
        dy=e.y_root-self.note_drag_y;self.note_drag_y=e.y_root
        new=max(3,min(23,int(self.notes.cget("height"))+round(dy/17)))
        self.notes.config(height=new);self.cfg["note_rows"]=new;save_settings(self.cfg)
    def restore_split(self):
        try:self.split.sashpos(0,int(self.cfg.get("split",365)))
        except:pass
        self.notes.config(height=int(self.cfg.get("note_rows",5)))
    def calc_update(self):
        for a,b,total in self.calc_fields:
            try:total.config(text=money(num(a.get())+num(b.get())))
            except:total.config(text="Valor inválido",fg=RED)
    def calc_clear(self):
        for a,b,t in self.calc_fields:a.delete(0,"end");b.delete(0,"end")
        self.calc_update()
    def update_prices(self):
        try:
            total=sum(max(0,int(e.get() or "0"))*int(t[1:]) for t,e in self.groups.items())
            self.price_total.config(text=money(total),fg=GREEN)
        except:self.price_total.config(text="Quantidade inválida",fg=RED)
    def copy_pix(self):
        self.update_prices();amount=self.price_total.cget("text")
        text=f"📌 PIX CELULAR\n💠 81995882238\n🏷️ MICAEL RICARDO\n\n────────────\n\n💸 {amount}\n⚠️ MARCAR E ENVIAR O COMPROVANTE\n\n────────────\n\n⏱️ Prazo para conclusão: de 30 min a 1h após o envio do comprovante."
        self.clipboard_clear();self.clipboard_append(text);self.update()
        messagebox.showinfo("PEAK","Comanda copiada.")
    def add_order(self):
        try:
            dep=num(self.inputs["deposit"].get());wd=num(self.inputs["withdrawal"].get());blog=num(self.inputs["blogger"].get())
            if min(dep,wd,blog)<0:raise ValueError("Os valores da operação não podem ser negativos.")
            client=self.inputs["client"].get().strip()
            if not client:raise ValueError("Informe o nome da cliente.")
            self.conn.execute("INSERT INTO orders(created,client,phone,link,deposit,withdrawal,blogger) VALUES(?,?,?,?,?,?,?)",
              (datetime.datetime.now().isoformat(timespec="seconds"),client,self.inputs["phone"].get().strip(),self.inputs["link"].get().strip(),dep,wd,blog))
            self.conn.commit()
            for e in self.inputs.values():e.delete(0,"end")
            self.refresh()
        except Exception as e:messagebox.showerror("Verifique os dados",str(e))
    def refresh(self):
        for i in self.table.get_children():self.table.delete(i)
        rows=self.conn.execute("SELECT id,client,link,deposit,withdrawal,blogger FROM orders ORDER BY id DESC").fetchall()
        dep=wd=blog=0
        for id,client,link,d,w,b in rows:
            profit=w+b-d;dep+=d;wd+=w;blog+=b
            self.table.insert("", "end",iid=str(id),values=(client,link,money(d),money(w),money(b),money(profit)),tags=("negative" if profit<0 else "positive",))
        for k,v in (("Depósitos",dep),("Saques",wd),("Blogueira",blog),("Lucro líquido",wd+blog-dep)):
            self.totals[k].config(text=money(v),fg=RED if v<0 else GREEN if k=="Lucro líquido" else PURPLE if k=="Blogueira" else GOLD if k=="Saques" else BLUE)
    def selected_id(self):
        s=self.table.selection()
        if not s:messagebox.showinfo("PEAK","Selecione uma operação.");return None
        return int(s[0])
    def delete_selected(self):
        id=self.selected_id()
        if id and messagebox.askyesno("Excluir","Excluir esta operação?"):
            self.conn.execute("DELETE FROM orders WHERE id=?",(id,));self.conn.commit();self.refresh()
    def edit_selected(self):
        id=self.selected_id()
        if not id:return
        row=self.conn.execute("SELECT client,phone,link,deposit,withdrawal,blogger FROM orders WHERE id=?",(id,)).fetchone()
        win=tk.Toplevel(self);win.title("Editar operação");win.configure(bg=PANEL);win.geometry("390x390");win.transient(self);win.grab_set()
        entries=[]
        for title,value in zip(("Nome da cliente","Telefone","Link","Depósito","Saque","Blogueira"),row):
            self.label(win,title,MUTED,9).pack(anchor="w",padx=15,pady=(7,0))
            e=self.entry(win);e.pack(fill="x",padx=15);e.insert(0,str(value));entries.append(e)
        def save():
            try:
                v=[e.get().strip() for e in entries];a,b,c=map(num,v[3:])
                if min(a,b,c)<0:raise ValueError("Valores negativos não são permitidos.")
                if not v[0]:raise ValueError("Informe a cliente.")
                self.conn.execute("UPDATE orders SET client=?,phone=?,link=?,deposit=?,withdrawal=?,blogger=? WHERE id=?",(v[0],v[1],v[2],a,b,c,id))
                self.conn.commit();self.refresh();win.destroy()
            except Exception as exc:messagebox.showerror("Erro",str(exc),parent=win)
        self.btn(win,"Salvar alterações",save,True).pack(pady=12)
    def generator(self):
        w=tk.Toplevel(self);w.title("Gerador de Depósitos Variados");w.configure(bg=PANEL);w.geometry("560x520");w.transient(self)
        self.label(w,"⤨  Gerador de Depósitos Variados",BLUE,12,True).pack(anchor="w",padx=18,pady=15)
        mode=tk.StringVar(value="11–15");r=tk.Frame(w,bg=PANEL);r.pack(fill="x",padx=15)
        for option in ("11–15","15–18","19–25","Personalizado"):
            tk.Radiobutton(r,text=option,variable=mode,value=option,bg=PANEL,fg=FG,selectcolor="#25354a",activebackground=PANEL,activeforeground=BLUE).pack(side="left",padx=5)
        inputs=tk.Frame(w,bg=PANEL);inputs.pack(fill="x",padx=18,pady=14)
        self.label(inputs,"Mínimo",MUTED,9).grid(row=0,column=0,sticky="w")
        self.label(inputs,"Máximo",MUTED,9).grid(row=0,column=1,sticky="w")
        self.label(inputs,"Quantidade",MUTED,9).grid(row=0,column=2,sticky="w")
        mi=self.entry(inputs,8);ma=self.entry(inputs,8);q=self.entry(inputs,8)
        for i,e in enumerate((mi,ma,q)):e.grid(row=1,column=i,padx=(0,10),sticky="ew")
        mi.insert(0,"11");ma.insert(0,"15");q.insert(0,"10")
        def update_mode(*args):
            if mode.get()!="Personalizado":
                a,b=mode.get().split("–")
                for e,v in ((mi,a),(ma,b)):e.delete(0,"end");e.insert(0,v)
        mode.trace_add("write",update_mode)
        results=tk.Text(w,height=12,bg=FIELD,fg=BLUE,insertbackground=FG,relief="flat",font=("Consolas",11))
        results.pack(fill="both",expand=True,padx=18,pady=6)
        total=self.label(w,"Nenhuma lista gerada · R$ 0,00",GREEN,11,True);total.pack(anchor="e",padx=18,pady=5)
        def generate():
            try:
                a,b,n=int(mi.get()),int(ma.get()),int(q.get())
                if a<0 or b<a or n<1 or n>500 or b>100000:raise ValueError("Use mínimo ≤ máximo e quantidade de 1 a 500.")
                vals=[random.randint(a,b) for _ in range(n)]
                results.delete("1.0","end");results.insert("1.0","\n".join(map(str,vals)))
                total.config(text=f"{n} depósitos · {money(sum(vals))}")
            except Exception as ex:messagebox.showerror("Gerador",str(ex),parent=w)
        def copy():
            self.clipboard_clear();self.clipboard_append(results.get("1.0","end-1c"));self.update()
        actions=tk.Frame(w,bg=PANEL);actions.pack(fill="x",padx=18,pady=14)
        self.btn(actions,"Gerar depósitos",generate,True).pack(side="left")
        self.btn(actions,"Copiar lista",copy).pack(side="right")
    def closing(self):
        rows=self.conn.execute("SELECT created,client,phone,link,deposit,withdrawal,blogger FROM orders ORDER BY id").fetchall()
        if not rows:messagebox.showinfo("Fechamento","Não existem operações para fechar.");return
        if not messagebox.askyesno("Fechamento diário",f"Exportar {len(rows)} operações para Excel e limpar o painel após salvar?"):return
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font,PatternFill
            wb=Workbook();ws=wb.active;ws.title="Operações"
            ws.append(["Data","Nome da cliente","Telefone da cliente","Link da conta","Depósito","Saque","Blogueira","Lucro líquido"])
            for created,client,phone,link,d,w,b in rows:ws.append([created,client,phone,link,d,w,b,w+b-d])
            for cell in ws[1]:
                cell.font=Font(bold=True,color="FFFFFF");cell.fill=PatternFill("solid",fgColor="17263B")
            for col,width in {"A":21,"B":27,"C":22,"D":40,"E":17,"F":17,"G":17,"H":20}.items():ws.column_dimensions[col].width=width
            for row in ws.iter_rows(min_row=2,min_col=5,max_col=8):
                for cell in row:cell.number_format='"R$" #,##0.00'
            summary=wb.create_sheet("Resumo")
            summary.append(["Fechamento diário",datetime.datetime.now().strftime("%d/%m/%Y %H:%M")])
            summary.append(["Total de serviços",len(rows)])
            summary.append(["Total depósitos",sum(r[4] for r in rows)])
            summary.append(["Total saques",sum(r[5] for r in rows)])
            summary.append(["Total pago pelas blogueiras",sum(r[6] for r in rows)])
            summary.append(["Lucro líquido",sum(r[5]+r[6]-r[4] for r in rows)])
            summary.column_dimensions["A"].width=35;summary.column_dimensions["B"].width=25
            folder=APP_DIR/"Fechamentos";folder.mkdir(exist_ok=True)
            target=folder/("Fechamento_"+datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")+".xlsx")
            wb.save(target)
            if not target.exists() or target.stat().st_size==0:raise RuntimeError("O arquivo não foi salvo.")
            # Commit deletion only after successful Excel write.
            ids=[r[0] for r in self.conn.execute("SELECT id FROM orders").fetchall()]
            with self.conn:self.conn.executemany("DELETE FROM orders WHERE id=?",[(i,) for i in ids])
            self.refresh();messagebox.showinfo("Fechamento salvo",f"Excel salvo em:\n{target}")
        except Exception as e:messagebox.showerror("Falha no fechamento",f"Os registros foram preservados.\n{e}")
    def open_folder(self):
        if sys.platform=="win32":os.startfile(APP_DIR)
        elif sys.platform=="darwin":subprocess.Popen(["open",str(APP_DIR)])
        else:subprocess.Popen(["xdg-open",str(APP_DIR)])
    def close(self):
        try:self.cfg["split"]=self.split.sashpos(0);save_settings(self.cfg)
        except:pass
        self.conn.close();self.destroy()
if __name__=="__main__":Peak().mainloop()
