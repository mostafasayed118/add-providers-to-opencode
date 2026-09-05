export type Locale = "en" | "ar";

export type Strings = {
  dir: "ltr" | "rtl";
  toggleLang: string;
  toggleTheme: string;
  title: string;
  subtitle: string;
  footer: string;
  provider: string;
  newProvider: string;
  sectionCredentials: string;
  sectionModel: string;  modelToEdit: string;
  newModel: string;
  otherModelsKept: string;
  providerType: string;
  typeOpenAI: string;
  typeOpenAIDesc: string;
  typeCustom: string;
  typeCustomDesc: string;
  providerId: string;
  baseUrl: string;
  baseUrlHint: string;
  apiKey: string;
  keepKeyHint: string;
  show: string;
  hide: string;
  modelId: string;
  testConnection: string;
  testing: string;
  capabilities: string;
  capabilitiesNote: string;
  contextWindow: string;
  maxOutput: string;
  toolCalling: string;
  toolCallingHint: string;
  reasoning: string;
  reasoningHint: string;
  attachments: string;
  attachmentsHint: string;
  reasoningField: string;
  reasoningFieldHint: string;
  reasoningFieldNone: string;
  keyStorage: string;
  keyStorageInline: string;
  keyStorageInlineDesc: string;
  keyStorageEnv: string;
  keyStorageEnvDesc: string;
  keyStorageFile: string;
  keyStorageFileDesc: string;
  keyEnvName: string;
  keyFile: string;
  headers: string;
  headersHint: string;
  headerName: string;
  headerValue: string;
  addHeader: string;
  smallModel: string;
  smallModelHint: (stored: string | null) => string;
  submit: string;
  saving: string;
  loadCurrent: string;
  reset: string;
  saved: string;
  savedModel: (model: string) => string;
  savedFile: (path: string) => string;
  savedBackup: (backup: string) => string;
  deleteProvider: (id: string) => string;
  deleteConfirm: (id: string) => string;
  deleteYes: string;
  cancel: string;
  deleting: string;
  onboarding: (count: number, model: string | null) => string;
  loadActive: string;
  startFresh: string;
  backups: string;
  backupsHint: string;
  noBackups: string;
  restore: string;
  restoring: string;
  corruptBadge: string;
  backupsPrev: string;
  backupsNext: string;
  backupsPage: (page: number, total: number) => string;
  pagerPrev: string;
  pagerNext: string;
  pagerPage: (page: number, total: number) => string;
  searchProviders: string;
  presets: string;
  previewTitle: string;
  previewNoChanges: string;
  previewAdded: string;
  previewRemoved: string;
  confirmApply: string;
  backToEdit: string;
  previewing: string;
  testPrompt: string;
  promptTesting: string;
  promptHint: string;
  doctor: string;
  doctorHint: string;
  doctorCheck: string;
  doctorChecking: string;
  noIssues: string;
  fix: string;
  fixing: string;
  fixFailed: string;
  fixed: (what: string) => string;
  history: string;
  historyHint: string;
  noHistory: string;
  clone: string;
  cloning: string;
  cloneFailed: string;
  cloned: (id: string) => string;
  undoLast: string;
  promptOk: (reply: string) => string;
  gatesTitle: string;
  gatesHint: string;
  gateAuto: string;
  gateEnabled: string;
  gateDisabled: string;
  gateFailed: string;
  externalChanged: string;
  reloadNow: string;
  dismiss: string;
  manageTitle: string;
  manageHint: string;
  deleteSelected: (n: number) => string;
  deletingSelected: string;
  bulkDeleted: (n: number, model: string) => string;
  exportBtn: string;
  importBtn: string;
  importing: string;
  importHint: string;
  exportFailed: string;
  importFailed: string;
  importBadJson: string;
  imported: (ids: string) => string;
  sortLabel: string;
  sortNewest: string;
  sortOldest: string;
  sortLargest: string;  apiKeyRequired: string;
  keyEnvNameRequired: string;
  keyFileRequired: string;
  testOk: (count: number) => string;
  testFailed: string;
  networkError: string;
  saveFailed: string;
  loadFailed: string;
  deleteFailed: string;
  restoreFailed: string;
  deleted: string;
  deletedActive: (model: string) => string;
  restored: (model: string) => string;
  currentModel: (model: string, path: string) => string;
  noConfig: (path: string) => string;
  none: string;
};

const en: Strings = {
  dir: "ltr",
  toggleLang: "عربي",
  toggleTheme: "Toggle dark mode",
  title: "Opencode Provider Setup",
  subtitle:
    "Enter your endpoint, key, and model. On submit we validate and write the global opencode config automatically.",
  footer: "Writes global ~/.config/opencode/opencode.json and sets top-level model.",
  provider: "Provider",
  newProvider: "+ New provider…",
  sectionCredentials: "Credentials",
  sectionModel: "Model",
  modelToEdit: "Model to edit",
  newModel: "+ New model…",
  otherModelsKept: "Other models on this provider are left untouched.",
  providerType: "Provider type",
  typeOpenAI: "OpenAI-compatible",
  typeOpenAIDesc: "Any OpenAI-style /v1 endpoint",
  typeCustom: "Custom",
  typeCustomDesc: "Custom provider id + same protocol",
  providerId: "Provider ID",
  baseUrl: "Base URL",
  baseUrlHint: "https required, except localhost / LAN.",
  apiKey: "API Key",
  keepKeyHint: "Leave blank to keep the stored key, or type a new one to replace it.",
  show: "Show",
  hide: "Hide",
  modelId: "Model ID",
  testConnection: "Test connection",
  testing: "Testing…",
  capabilities: "Model capabilities",
  capabilitiesNote: "(optional — shown in opencode as Context / Reasoning / Inputs)",
  contextWindow: "Context window",
  maxOutput: "Max output tokens",
  toolCalling: "Tool calling",
  toolCallingHint: "Model can use opencode tools (recommended on)",
  reasoning: "Reasoning",
  reasoningHint: "Model exposes thinking blocks",
  attachments: "Attachments (images)",
  attachmentsHint: "Writes modalities input text+image so opencode shows image Inputs",
  reasoningField: "Reasoning stream field",
  reasoningFieldHint: "For models (e.g. GLM) streaming thinking in a custom field. Leave empty if unsure.",
  reasoningFieldNone: "None",
  keyStorage: "API key storage",
  keyStorageInline: "In config file",
  keyStorageInlineDesc: "Simplest; secret lives in opencode.json",
  keyStorageEnv: "Environment variable",
  keyStorageEnvDesc: "Config keeps a {env:NAME} reference only",
  keyStorageFile: "Separate file",
  keyStorageFileDesc: "Key file with owner-only permissions",
  keyEnvName: "Env var name",
  keyFile: "Key file path",
  headers: "Custom headers",
  headersHint: "Optional request headers. Blank value on a stored name keeps the stored secret.",
  headerName: "Name",
  headerValue: "Value",
  addHeader: "+ Add header",
  smallModel: "Small model (optional)",
  smallModelHint: (stored) =>
    stored
      ? `Currently: ${stored}. Leave blank to keep it.`
      : "Cheap model for titles etc, as provider/model. Blank = don't set.",
  submit: "Submit & Apply to Opencode",
  saving: "Saving…",
  loadCurrent: "Load current",
  reset: "Reset",
  saved: "Saved. Opencode will use it automatically.",
  savedModel: (model) => `Model: ${model}`,
  savedFile: (path) => `File: ${path}`,
  savedBackup: (backup) => `Backup: ${backup}`,
  deleteProvider: (id) => `Delete provider “${id}”…`,
  deleteConfirm: (id) => `Delete provider “${id}” and all its models?`,
  deleteYes: "Yes, delete",
  cancel: "Cancel",
  deleting: "Deleting…",
  onboarding: (count, model) =>
    `Found ${count} configured provider${count === 1 ? "" : "s"}${model ? `, active model ${model}` : ""}. Load it into the form or start fresh.`,
  loadActive: "Load active model",
  startFresh: "Start fresh",
  backups: "Backups",
  backupsHint: "Timestamped copies made before every write. Restoring backs up the live file first.",
  noBackups: "No backups yet — they appear after your first save.",
  restore: "Restore",
  restoring: "Restoring…",
  corruptBadge: "corrupt copy",
  backupsPrev: "Previous",
  backupsNext: "Next",
  backupsPage: (page, total) => `Page ${page} of ${total}`,
  pagerPrev: "Previous",
  pagerNext: "Next",
  pagerPage: (page, total) => `Page ${page} of ${total}`,
  searchProviders: "Search providers…",
  presets: "Start from a preset",
  previewTitle: "Review changes",
  previewNoChanges: "No changes — the config already matches.",
  previewAdded: "added",
  previewRemoved: "removed",
  confirmApply: "Confirm & Apply",
  backToEdit: "Back to edit",
  previewing: "Building preview…",
  testPrompt: "Send test prompt",
  promptTesting: "Asking…",
  promptHint: "Sends one tiny prompt to prove the model answers. Costs a few tokens.",
  doctor: "Config health",
  doctorHint: "Static checks over the whole file. No network involved.",
  doctorCheck: "Run checks",
  doctorChecking: "Checking…",
  noIssues: "No issues found.",
  fix: "Fix",
  fixing: "Fixing…",
  fixFailed: "Fix failed.",
  fixed: (what) => `Fixed: ${what}`,
  history: "Change history",
  historyHint: "Every save, delete, restore and clone, newest first.",
  noHistory: "No changes recorded yet.",
  clone: "Clone provider",
  cloning: "Cloning…",
  cloneFailed: "Clone failed.",
  cloned: (id) => `Cloned as “${id}”. It is now loaded in the form.`,
  undoLast: "Undo last change",
  promptOk: (reply) => `Model answered: ${reply}`,
  gatesTitle: "Availability",
  gatesHint: "Allow-list (enabled) or deny-list (disabled) this provider. Disabled wins.",
  gateAuto: "Auto",
  gateEnabled: "Enabled",
  gateDisabled: "Disabled",
  gateFailed: "Could not update availability.",
  externalChanged: "opencode.json changed outside this app.",
  reloadNow: "Reload",
  dismiss: "Dismiss",
  manageTitle: "Manage providers",
  manageHint: "Tick providers to delete several at once.",
  deleteSelected: (n) => `Delete selected (${n})`,
  deletingSelected: "Deleting…",
  bulkDeleted: (n, model) => `Deleted ${n} providers. Active model is now ${model}.`,
  exportBtn: "Export pack",
  importBtn: "Import pack",
  importing: "Importing…",
  importHint: "Exported packs redact secrets; re-enter keys on import.",
  exportFailed: "Export failed.",
  importFailed: "Import failed.",
  importBadJson: "File is not valid JSON.",
  imported: (ids) => `Imported: ${ids}`,
  sortLabel: "Sort",
  sortNewest: "Newest",
  sortOldest: "Oldest",
  sortLargest: "Largest",
  apiKeyRequired: "api_key is required.",
  keyEnvNameRequired: "Choose an env var name to store the key in.",
  keyFileRequired: "Choose a file path to store the key in.",
  testOk: (count) =>
    `Reachable. ${count} model${count === 1 ? "" : "s"} discovered — pick one from the Model ID suggestions.`,
  testFailed: "Connection failed.",
  networkError: "Network error. Is the app server running?",
  saveFailed: "Save failed.",
  loadFailed: "Could not load current config.",
  deleteFailed: "Delete failed.",
  restoreFailed: "Restore failed.",
  deleted: "Provider deleted.",
  deletedActive: (model) =>
    `Provider deleted. It was the active model; opencode now uses ${model}.`,
  restored: (model) => `Restored. Active model is now ${model}.`,
  currentModel: (model, path) => `Current model: ${model} @ ${path}`,
  noConfig: (path) => `No global config yet. It will be created at ${path}`,
  none: "(none)",
};

const ar: Strings = {
  dir: "rtl",
  toggleLang: "EN",
  toggleTheme: "تبديل الوضع الداكن",
  title: "إعداد مزوّد Opencode",
  subtitle: "أدخل العنوان والمفتاح والنموذج. عند الإرسال نتحقق ونكتب إعداد opencode العام تلقائيًا.",
  footer: "يكتب ‎~/.config/opencode/opencode.json‎ العام ويضبط النموذج.",
  provider: "المزوّد",
  newProvider: "+ مزوّد جديد…",
  sectionCredentials: "بيانات الدخول",
  sectionModel: "النموذج",
  modelToEdit: "النموذج المراد تحريره",
  newModel: "+ نموذج جديد…",
  otherModelsKept: "بقية النماذج لدى هذا المزوّد تبقى كما هي.",
  providerType: "نوع المزوّد",
  typeOpenAI: "متوافق مع OpenAI",
  typeOpenAIDesc: "أي نقطة نهاية /v1 بأسلوب OpenAI",
  typeCustom: "مخصص",
  typeCustomDesc: "معرّف مخصص + نفس البروتوكول",
  providerId: "معرّف المزوّد",
  baseUrl: "الرابط الأساسي",
  baseUrlHint: "يلزم https باستثناء localhost / الشبكة المحلية.",
  apiKey: "مفتاح API",
  keepKeyHint: "اتركه فارغًا للاحتفاظ بالمفتاح المحفوظ، أو اكتب مفتاحًا جديدًا لاستبداله.",
  show: "إظهار",
  hide: "إخفاء",
  modelId: "معرّف النموذج",
  testConnection: "اختبار الاتصال",
  testing: "جارٍ الاختبار…",
  capabilities: "قدرات النموذج",
  capabilitiesNote: "(اختياري — يظهر في opencode كـ Context / Reasoning / Inputs)",
  contextWindow: "نافذة السياق",
  maxOutput: "أقصى رموز للإخراج",
  toolCalling: "استدعاء الأدوات",
  toolCallingHint: "يمكن للنموذج استخدام أدوات opencode (يُنصح بتفعيله)",
  reasoning: "الاستدلال",
  reasoningHint: "النموذج يعرض مقاطع التفكير",
  attachments: "المرفقات (صور)",
  attachmentsHint: "يكتب modalities بإدخال نص+صورة ليظهر opencode مدخلات الصور",
  reasoningField: "حقل بث الاستدلال",
  reasoningFieldHint: "للنماذج (مثل GLM) التي تبث التفكير في حقل مخصص. اتركه فارغًا إن لم تكن متأكدًا.",
  reasoningFieldNone: "بلا",
  keyStorage: "تخزين مفتاح API",
  keyStorageInline: "في ملف الإعداد",
  keyStorageInlineDesc: "الأسهل؛ السر يبقى في opencode.json",
  keyStorageEnv: "متغير بيئة",
  keyStorageEnvDesc: "يحفظ الإعداد مرجع {env:NAME} فقط",
  keyStorageFile: "ملف منفصل",
  keyStorageFileDesc: "ملف مفتاح بصلاحيات المالك فقط",
  keyEnvName: "اسم متغير البيئة",
  keyFile: "مسار ملف المفتاح",
  headers: "ترويسات مخصصة",
  headersHint: "ترويسات طلب اختيارية. القيمة الفارغة لاسم محفوظ تُبقي السر المحفوظ.",
  headerName: "الاسم",
  headerValue: "القيمة",
  addHeader: "+ إضافة ترويسة",
  smallModel: "نموذج صغير (اختياري)",
  smallModelHint: (stored) =>
    stored
      ? `الحالي: ${stored}. اتركه فارغًا للاحتفاظ به.`
      : "نموذج رخيص للعناوين إلخ بصيغة provider/model. فارغ = لا تضبط.",
  submit: "إرسال وتطبيق على Opencode",
  saving: "جارٍ الحفظ…",
  loadCurrent: "عرض الحالي",
  reset: "تصفير",
  saved: "تم الحفظ. سيستخدمه opencode تلقائيًا.",
  savedModel: (model) => `النموذج: ${model}`,
  savedFile: (path) => `الملف: ${path}`,
  savedBackup: (backup) => `النسخة الاحتياطية: ${backup}`,
  deleteProvider: (id) => `حذف المزوّد “${id}”…`,
  deleteConfirm: (id) => `حذف المزوّد “${id}” وكل نماذجه؟`,
  deleteYes: "نعم، احذف",
  cancel: "إلغاء",
  deleting: "جارٍ الحذف…",
  onboarding: (count, model) =>
    `وجدنا ${count} من المزوّدين${model ? `، والنموذج النشط ${model}` : ""}. حمّله في النموذج أو ابدأ من جديد.`,
  loadActive: "تحميل النموذج النشط",
  startFresh: "بدء جديد",
  backups: "النسخ الاحتياطية",
  backupsHint: "نسخ مؤرخة قبل كل كتابة. الاستعادة تنسخ الملف الحي أولًا.",
  noBackups: "لا نسخ بعد — تظهر بعد أول حفظ.",
  restore: "استعادة",
  restoring: "جارٍ الاستعادة…",
  corruptBadge: "نسخة تالفة",
  backupsPrev: "السابق",
  backupsNext: "التالي",
  backupsPage: (page, total) => `صفحة ${page} من ${total}`,
  pagerPrev: "السابق",
  pagerNext: "التالي",
  pagerPage: (page, total) => `صفحة ${page} من ${total}`,
  searchProviders: "ابحث في المزوّدين…",
  presets: "ابدأ من قالب جاهز",
  previewTitle: "مراجعة التغييرات",
  previewNoChanges: "لا تغييرات — الإعداد مطابق أصلًا.",
  previewAdded: "مُضاف",
  previewRemoved: "محذوف",
  confirmApply: "تأكيد وتطبيق",
  backToEdit: "عودة للتحرير",
  previewing: "جارٍ بناء المعاينة…",
  testPrompt: "إرسال رسالة اختبار",
  promptTesting: "جارٍ السؤال…",
  promptHint: "يرسل رسالة صغيرة لإثبات رد النموذج. يكلف رموزًا قليلة.",
  doctor: "صحة الإعداد",
  doctorHint: "فحوصات ثابتة للملف كاملًا. بلا شبكة.",
  doctorCheck: "تشغيل الفحص",
  doctorChecking: "جارٍ الفحص…",
  noIssues: "لا مشاكل.",
  fix: "إصلاح",
  fixing: "جارٍ الإصلاح…",
  fixFailed: "فشل الإصلاح.",
  fixed: (what) => `تم الإصلاح: ${what}`,
  history: "سجل التغييرات",
  historyHint: "كل حفظ وحذف واستعادة ونسخ، الأحدث أولًا.",
  noHistory: "لا تغييرات مسجلة بعد.",
  clone: "نسخ المزوّد",
  cloning: "جارٍ النسخ…",
  cloneFailed: "فشل النسخ.",
  cloned: (id) => `تم النسخ باسم “${id}”. وهو محمّل الآن في النموذج.`,
  undoLast: "التراجع عن آخر تغيير",
  promptOk: (reply) => `أجاب النموذج: ${reply}`,
  gatesTitle: "التوفّر",
  gatesHint: "السماح (enabled) أو المنع (disabled) لهذا المزوّد. المنع يغلّب.",
  gateAuto: "تلقائي",
  gateEnabled: "مسموح",
  gateDisabled: "ممنوع",
  gateFailed: "تعذّر تحديث التوفّر.",
  externalChanged: "تغيّر opencode.json خارج هذا التطبيق.",
  reloadNow: "إعادة تحميل",
  dismiss: "تجاهل",
  manageTitle: "إدارة المزوّدين",
  manageHint: "علّم المزوّدين لحذف عدة مزوّدين دفعة واحدة.",
  deleteSelected: (n) => `حذف المحدد (${n})`,
  deletingSelected: "جارٍ الحذف…",
  bulkDeleted: (n, model) => `حُذف ${n} من المزوّدين. النموذج النشط الآن ${model}.`,
  exportBtn: "تصدير حزمة",
  importBtn: "استيراد حزمة",
  importing: "جارٍ الاستيراد…",
  importHint: "الحزم المصدّرة تخفي الأسرار؛ أعد إدخال المفاتيح عند الاستيراد.",
  exportFailed: "فشل التصدير.",
  importFailed: "فشل الاستيراد.",
  importBadJson: "الملف ليس JSON صالحًا.",
  imported: (ids) => `تم الاستيراد: ${ids}`,
  sortLabel: "ترتيب",
  sortNewest: "الأحدث",
  sortOldest: "الأقدم",
  sortLargest: "الأكبر",
  apiKeyRequired: "مفتاح API مطلوب.",
  keyEnvNameRequired: "اختر اسم متغير بيئة لتخزين المفتاح.",
  keyFileRequired: "اختر مسار ملف لتخزين المفتاح.",
  testOk: (count) => `يمكن الوصول إليه. اكتُشف ${count} من النماذج — اختر من اقتراحات معرّف النموذج.`,
  testFailed: "فشل الاتصال.",
  networkError: "خطأ في الشبكة. هل خادم التطبيق يعمل؟",
  saveFailed: "فشل الحفظ.",
  loadFailed: "تعذّر تحميل الإعداد الحالي.",
  deleteFailed: "فشل الحذف.",
  restoreFailed: "فشلت الاستعادة.",
  deleted: "تم حذف المزوّد.",
  deletedActive: (model) => `تم حذف المزوّد. كان النموذج النشط؛ يستخدم opencode الآن ${model}.`,
  restored: (model) => `تمت الاستعادة. النموذج النشط الآن ${model}.`,
  currentModel: (model, path) => `النموذج الحالي: ${model} @ ${path}`,
  noConfig: (path) => `لا يوجد إعداد عام بعد. سيُنشأ في ${path}`,
  none: "(لا يوجد)",
};

export const strings: Record<Locale, Strings> = { en, ar };
