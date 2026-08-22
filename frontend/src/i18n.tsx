import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "tr" | "en";

const STORAGE = "pts.lang";

/// Metinler tek sozlukte tutulur. Anahtar eksikse anahtarin kendisi
/// gosterilir; boylece unutulan bir metin ekranda hemen fark edilir.
const TR = {
  "app.name": "PTS",
  "app.subtitle": "Personel Takip",
  "app.title": "Personel Takip Sistemi",
  "app.concept": "Fikir",
  "app.developedBy": "Geliştiren",
  "app.loading": "Yükleniyor...",

  "nav.tracking": "Takip",
  "nav.cardKiosk": "Kart & Kiosk",
  "nav.management": "Yönetim",
  "nav.dashboard": "Genel Bakış",
  "nav.timesheet": "Puantaj",
  "nav.employees": "Personel",
  "nav.kiosk": "Geçiş Kiosku",
  "nav.cards": "Kart Üret",
  "nav.checkpoints": "Geçiş Noktaları",
  "nav.companies": "Firmalar",
  "nav.users": "Kullanıcılar",
  "nav.logout": "Çıkış",

  "common.add": "Ekle",
  "common.save": "Kaydet",
  "common.cancel": "Vazgeç",
  "common.edit": "Düzenle",
  "common.close": "Kapat",
  "common.print": "Yazdır",
  "common.show": "Göster",
  "common.hide": "Gizle",
  "common.copy": "Kopyala",
  "common.copied": "Kopyalandı",
  "common.all": "Tümü",
  "common.active": "aktif",
  "common.passive": "pasif",
  "common.deactivate": "Pasife al",
  "common.company": "Firma",
  "common.allCompanies": "Tüm firmalar",
  "common.title": "Unvan",
  "common.date": "Tarih",
  "common.search": "Ara",
  "common.none": "yok",
  "common.never": "hiç",
  "common.records": "kayıt",
  "common.status": "Durum",
  "common.actions": "İşlem",
  "common.in": "GİRİŞ",
  "common.out": "ÇIKIŞ",

  "login.signIn": "Giriş yap",
  "login.subtitle": "Panel hesabınızla oturum açın.",
  "login.username": "Kullanıcı adı",
  "login.password": "Parola",
  "login.submit": "Giriş",
  "login.checking": "Kontrol ediliyor...",
  "login.taglineA": "Personel Takip",
  "login.taglineB": "Sistemi",
  "login.brandSub":
    "Şantiyeden ofise tek platform — ArUco kartla temassız geçiş, günlük puantaj, vardiya ve izin yönetimi.",
  "login.f1.title": "ArUco kart",
  "login.f1.text": "Kamerayla temassız geçiş",
  "login.f2.title": "Puantaj",
  "login.f2.text": "Günlük giriş-çıkış ve süre",
  "login.f3.title": "Çok noktalı",
  "login.f3.text": "Giriş ve çıkış kioskları",
  "login.f4.title": "İzin",
  "login.f4.text": "Talep ve onay akışı",
  "login.soon": "Yakında",

  "dash.title": "Genel Bakış",
  "dash.employees": "Aktif personel",
  "dash.withCard": "kartlı",
  "dash.inside": "Şu an içeride",
  "dash.presentToday": "Bugün gelen",
  "dash.workedToday": "Bugün çalışılan",
  "dash.checkpoints": "Aktif nokta",
  "dash.chart": "Son 7 gün — çalışma saati",
  "dash.recent": "Son hareketler",
  "dash.noEvents": "Henüz hareket yok.",

  "sheet.title": "Puantaj",
  "sheet.filter": "Filtre",
  "sheet.today": "Bugün",
  "sheet.last7": "Son 7 gün",
  "sheet.last30": "Son 30 gün",
  "sheet.allEmployees": "Tüm personel",
  "sheet.searchPlaceholder": "Ad veya sicil ara",
  "sheet.export": "Excel'e aktar",
  "sheet.people": "Personel",
  "sheet.totalWork": "Toplam çalışma",
  "sheet.unmatched": "Eşleşmeyen hareket",
  "sheet.firstIn": "İlk giriş",
  "sheet.lastOut": "Son çıkış",
  "sheet.worked": "Çalışılan",
  "sheet.activity": "Aktivite",
  "sheet.empty": "Bu aralıkta hareket yok.",
  "sheet.incomplete": "eksik",
  "sheet.incompleteHint":
    "Çıkışı eşleşmeyen giriş var; süre eksik hesaplandı",
  "sheet.events": "hareket",
  "sheet.noPhoto": "foto yok",
  "sheet.noCheckpoint": "nokta yok",
  "sheet.manual": "elle",

  "emp.title": "Personel",
  "emp.new": "Yeni personel",
  "emp.no": "Sicil",
  "emp.noPlaceholder": "Sicil no",
  "emp.firstName": "Ad",
  "emp.lastName": "Soyad",
  "emp.fullName": "Ad Soyad",
  "emp.hiredOn": "İşe giriş",
  "emp.card": "Kart",
  "emp.assignCard": "ArUco tanımla",
  "emp.fromNo": "Sicilden",
  "emp.manualId": "Elle",
  "emp.assign": "Tanımla",
  "emp.revoke": "Kart iptal",
  "emp.printCard": "Kart",
  "emp.printCardHint": "Kartı önizle ve yazdır",
  "emp.needCard": "Önce ArUco kart tanımlayın",
  "emp.empty": "Henüz personel yok.",
  "emp.invalidId": "Geçerli bir ArUco ID girin",

  "cards.title": "ArUco Kart Üret",
  "cards.info": "Kart bilgileri",
  "cards.pickEmployee": "Personel seç...",
  "cards.noCard": "kart yok",
  "cards.labelPlaceholder": "Kart üzerine yazılacak ad",
  "cards.range":
    "sözlüğü, geçerli ID aralığı 0 - {max}. Kart, personele tanımlı ID ile aynı olmalı.",
  "cards.cardless":
    "Bu personele henüz kart tanımlı değil. Personel sayfasından \"Sicilden\" ile tanımlayın.",
  "cards.mismatch":
    "Gösterilen ID, personele tanımlı ID ({id}) ile aynı değil. Bu kart kiosk tarafından bu personel olarak okunmaz.",
  "cards.invalid": "Geçerli bir tam sayı girin.",

  "cp.title": "Geçiş Noktaları",
  "cp.info":
    "Her kiosk cihazı bir geçiş noktasına bağlanır. Anahtarı kiosk sayfasına bir kez girersiniz; cihaz o noktanın adına kayıt açar.",
  "cp.new": "Yeni nokta",
  "cp.code": "Kod",
  "cp.name": "Ad",
  "cp.optionalCompany": "Firma seç (isteğe bağlı)",
  "cp.create": "Oluştur",
  "cp.key": "Cihaz anahtarı",
  "cp.lastSeen": "Son görüldü",
  "cp.empty": "Henüz geçiş noktası yok.",

  "co.title": "Firmalar",
  "co.info":
    "Personel ve geçiş noktaları bir firmaya bağlanır. Kod kısa ve değişmeyen bir isim olmalı; raporlarda bu kod kullanılır.",
  "co.new": "Yeni firma",
  "co.employees": "Personel",
  "co.empty": "Henüz firma yok.",
  "co.hasEmployees": "Önce bağlı personeli başka firmaya taşıyın",

  "usr.title": "Kullanıcılar",
  "usr.info":
    "Yetkiler role bağlı: İzleyici yalnızca görüntüler, veri değiştiremez. Yönetici ayrıca kullanıcı, firma ve geçiş noktası tanımlar.",
  "usr.new": "Yeni kullanıcı",
  "usr.username": "Kullanıcı",
  "usr.role": "Rol",
  "usr.lastLogin": "Son giriş",
  "usr.passwordPlaceholder": "Parola (en az 8)",
  "usr.newPassword": "Yeni parola (boş: değişmez)",
  "usr.you": "siz",
  "usr.cannotSelf": "Kendi hesabınızı pasife alamazsınız",
  "usr.role.admin": "Yönetici",
  "usr.role.hr": "İnsan Kaynakları",
  "usr.role.manager": "Şef",
  "usr.role.viewer": "İzleyici",
  "usr.note.admin": "Her şeyi yapar, kullanıcı tanımlar",
  "usr.note.hr": "Personel ve kart işlemleri",
  "usr.note.manager": "Personel ve kart işlemleri",
  "usr.note.viewer": "Yalnızca görüntüler, değiştiremez",

  "kiosk.title": "Geçiş Kiosku",
  "kiosk.setup": "Kiosk Kurulumu",
  "kiosk.deviceKey": "Cihaz anahtarı",
  "kiosk.setupInfo":
    "Bu cihazı bir geçiş noktasına bağlayın. Anahtar doğrulanmadan kaydedilmez, böylece yanlış yapıştırma anında anlaşılır.",
  "kiosk.definedPoints": "Panelde tanımlı noktalar:",
  "kiosk.pasteKey": "Cihaz anahtarını yapıştırın",
  "kiosk.verify": "Doğrula ve kaydet",
  "kiosk.verifying": "Doğrulanıyor...",
  "kiosk.noPoints":
    "Henüz geçiş noktası tanımlı değil. \"Geçiş Noktaları\" sayfasından oluşturun.",
  "kiosk.point": "Nokta",
  "kiosk.dual": "İki kamerayı aynı anda çalıştır",
  "kiosk.dualHint": "Her panel kendi kamerasını ve yönünü hatırlar.",
  "kiosk.changeKey": "Cihaz anahtarını değiştir",
  "kiosk.entry": "Giriş",
  "kiosk.exit": "Çıkış",
  "kiosk.starting": "Kamera başlatılıyor...",
  "kiosk.defaultCamera": "Kamera: varsayılan",
  "kiosk.camera": "Kamera",
  "kiosk.mode.auto": "Otomatik",
  "kiosk.mode.in": "Sadece GİRİŞ",
  "kiosk.mode.out": "Sadece ÇIKIŞ",
  "kiosk.duplicate": "Zaten kaydedilmişti, tekrarlanmadı.",
  "kiosk.httpsOnly":
    "Kamera yalnızca HTTPS üzerinden kullanılabilir. Adres şu an ",
  "kiosk.cameraFailed": "Kamera açılamadı: ",
} as const;

type Key = keyof typeof TR;

const EN: Record<Key, string> = {
  "app.name": "PTS",
  "app.subtitle": "Staff Tracking",
  "app.title": "Staff Tracking System",
  "app.concept": "Concept",
  "app.developedBy": "Developed by",
  "app.loading": "Loading...",

  "nav.tracking": "Tracking",
  "nav.cardKiosk": "Cards & Kiosk",
  "nav.management": "Management",
  "nav.dashboard": "Overview",
  "nav.timesheet": "Timesheet",
  "nav.employees": "Employees",
  "nav.kiosk": "Access Kiosk",
  "nav.cards": "Card Maker",
  "nav.checkpoints": "Checkpoints",
  "nav.companies": "Companies",
  "nav.users": "Users",
  "nav.logout": "Sign out",

  "common.add": "Add",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.edit": "Edit",
  "common.close": "Close",
  "common.print": "Print",
  "common.show": "Show",
  "common.hide": "Hide",
  "common.copy": "Copy",
  "common.copied": "Copied",
  "common.all": "All",
  "common.active": "active",
  "common.passive": "inactive",
  "common.deactivate": "Deactivate",
  "common.company": "Company",
  "common.allCompanies": "All companies",
  "common.title": "Title",
  "common.date": "Date",
  "common.search": "Search",
  "common.none": "none",
  "common.never": "never",
  "common.records": "records",
  "common.status": "Status",
  "common.actions": "Actions",
  "common.in": "IN",
  "common.out": "OUT",

  "login.signIn": "Sign in",
  "login.subtitle": "Use your panel account.",
  "login.username": "Username",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.checking": "Checking...",
  "login.taglineA": "Staff Tracking",
  "login.taglineB": "System",
  "login.brandSub":
    "One platform from site to office — contactless access with ArUco cards, daily timesheets, shifts and leave.",
  "login.f1.title": "ArUco card",
  "login.f1.text": "Contactless access by camera",
  "login.f2.title": "Timesheet",
  "login.f2.text": "Daily in/out and hours",
  "login.f3.title": "Multi-point",
  "login.f3.text": "Entry and exit kiosks",
  "login.f4.title": "Leave",
  "login.f4.text": "Requests and approvals",
  "login.soon": "Soon",

  "dash.title": "Overview",
  "dash.employees": "Active staff",
  "dash.withCard": "with card",
  "dash.inside": "Currently inside",
  "dash.presentToday": "Present today",
  "dash.workedToday": "Worked today",
  "dash.checkpoints": "Active checkpoints",
  "dash.chart": "Last 7 days — working hours",
  "dash.recent": "Recent activity",
  "dash.noEvents": "No activity yet.",

  "sheet.title": "Timesheet",
  "sheet.filter": "Filter",
  "sheet.today": "Today",
  "sheet.last7": "Last 7 days",
  "sheet.last30": "Last 30 days",
  "sheet.allEmployees": "All staff",
  "sheet.searchPlaceholder": "Search name or ID",
  "sheet.export": "Export to Excel",
  "sheet.people": "Staff",
  "sheet.totalWork": "Total worked",
  "sheet.unmatched": "Unmatched events",
  "sheet.firstIn": "First in",
  "sheet.lastOut": "Last out",
  "sheet.worked": "Worked",
  "sheet.activity": "Activity",
  "sheet.empty": "No activity in this range.",
  "sheet.incomplete": "partial",
  "sheet.incompleteHint": "An entry has no matching exit; hours are understated",
  "sheet.events": "events",
  "sheet.noPhoto": "no photo",
  "sheet.noCheckpoint": "no checkpoint",
  "sheet.manual": "manual",

  "emp.title": "Employees",
  "emp.new": "New employee",
  "emp.no": "Staff no",
  "emp.noPlaceholder": "Staff no",
  "emp.firstName": "First name",
  "emp.lastName": "Last name",
  "emp.fullName": "Name",
  "emp.hiredOn": "Hired on",
  "emp.card": "Card",
  "emp.assignCard": "Assign ArUco",
  "emp.fromNo": "From staff no",
  "emp.manualId": "Manual",
  "emp.assign": "Assign",
  "emp.revoke": "Revoke card",
  "emp.printCard": "Card",
  "emp.printCardHint": "Preview and print the card",
  "emp.needCard": "Assign an ArUco card first",
  "emp.empty": "No employees yet.",
  "emp.invalidId": "Enter a valid ArUco ID",

  "cards.title": "ArUco Card Maker",
  "cards.info": "Card details",
  "cards.pickEmployee": "Select employee...",
  "cards.noCard": "no card",
  "cards.labelPlaceholder": "Name to print on the card",
  "cards.range":
    "dictionary, valid ID range 0 - {max}. The card must match the ID assigned to the employee.",
  "cards.cardless":
    "This employee has no card yet. Assign one from the Employees page using \"From staff no\".",
  "cards.mismatch":
    "The shown ID differs from the assigned ID ({id}). The kiosk will not read this card as this person.",
  "cards.invalid": "Enter a valid integer.",

  "cp.title": "Checkpoints",
  "cp.info":
    "Each kiosk device binds to a checkpoint. You enter its key once on the kiosk page; the device then records under that checkpoint.",
  "cp.new": "New checkpoint",
  "cp.code": "Code",
  "cp.name": "Name",
  "cp.optionalCompany": "Select company (optional)",
  "cp.create": "Create",
  "cp.key": "Device key",
  "cp.lastSeen": "Last seen",
  "cp.empty": "No checkpoints yet.",

  "co.title": "Companies",
  "co.info":
    "Employees and checkpoints belong to a company. Keep the code short and stable; reports use it.",
  "co.new": "New company",
  "co.employees": "Staff",
  "co.empty": "No companies yet.",
  "co.hasEmployees": "Move the attached staff to another company first",

  "usr.title": "Users",
  "usr.info":
    "Permissions follow the role: a Viewer can only read. An Admin also manages users, companies and checkpoints.",
  "usr.new": "New user",
  "usr.username": "User",
  "usr.role": "Role",
  "usr.lastLogin": "Last sign-in",
  "usr.passwordPlaceholder": "Password (min 8)",
  "usr.newPassword": "New password (blank: unchanged)",
  "usr.you": "you",
  "usr.cannotSelf": "You cannot deactivate your own account",
  "usr.role.admin": "Admin",
  "usr.role.hr": "Human Resources",
  "usr.role.manager": "Manager",
  "usr.role.viewer": "Viewer",
  "usr.note.admin": "Full access, manages users",
  "usr.note.hr": "Employee and card operations",
  "usr.note.manager": "Employee and card operations",
  "usr.note.viewer": "Read only, cannot change data",

  "kiosk.title": "Access Kiosk",
  "kiosk.setup": "Kiosk Setup",
  "kiosk.deviceKey": "Device key",
  "kiosk.setupInfo":
    "Bind this device to a checkpoint. The key is verified before it is stored, so a wrong paste is caught immediately.",
  "kiosk.definedPoints": "Checkpoints defined in the panel:",
  "kiosk.pasteKey": "Paste the device key",
  "kiosk.verify": "Verify and save",
  "kiosk.verifying": "Verifying...",
  "kiosk.noPoints":
    "No checkpoints defined yet. Create one on the \"Checkpoints\" page.",
  "kiosk.point": "Checkpoint",
  "kiosk.dual": "Run two cameras at once",
  "kiosk.dualHint": "Each pane remembers its own camera and direction.",
  "kiosk.changeKey": "Change device key",
  "kiosk.entry": "Entry",
  "kiosk.exit": "Exit",
  "kiosk.starting": "Starting camera...",
  "kiosk.defaultCamera": "Camera: default",
  "kiosk.camera": "Camera",
  "kiosk.mode.auto": "Automatic",
  "kiosk.mode.in": "IN only",
  "kiosk.mode.out": "OUT only",
  "kiosk.duplicate": "Already recorded, not repeated.",
  "kiosk.httpsOnly": "The camera works only over HTTPS. Current address: ",
  "kiosk.cameraFailed": "Camera could not start: ",
};

const DICTS: Record<Lang, Record<string, string>> = { tr: TR, en: EN };

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  /// Metni verir. {ad} bicimindeki yer tutucular params ile doldurulur.
  t: (key: Key, params?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem(STORAGE) as Lang | null) ?? "tr",
  );

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE, l);
    setLangState(l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: Key, params?: Record<string, string | number>) => {
      let text = DICTS[lang][key] ?? key;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n, I18nProvider icinde kullanilmali");
  return ctx;
}

/// Dil degistirme dugmeleri. Bilesen burada duruyor ki sayfalar
/// main.tsx'i import etmek zorunda kalmasin (dairesel bagimlilik olurdu).
export function LanguageSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button
        className={lang === "tr" ? "active" : ""}
        onClick={() => setLang("tr")}
      >
        TR
      </button>
      <button
        className={lang === "en" ? "active" : ""}
        onClick={() => setLang("en")}
      >
        EN
      </button>
    </div>
  );
}

/// Tarih ve saat bicimleri de dile uymali.
export function locale(lang: Lang): string {
  return lang === "tr" ? "tr-TR" : "en-GB";
}
