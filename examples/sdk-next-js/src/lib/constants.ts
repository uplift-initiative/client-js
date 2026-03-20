export const DEFAULT_VOICE_ID = "v_meklc281";

export const OUTPUT_FORMATS = [
  { value: "WAV_22050_32", label: "WAV 22kHz 32-bit (default)" },
  { value: "WAV_22050_16", label: "WAV 22kHz 16-bit" },
  { value: "MP3_22050_128", label: "MP3 22kHz 128kbps" },
  { value: "MP3_22050_64", label: "MP3 22kHz 64kbps" },
  { value: "MP3_22050_32", label: "MP3 22kHz 32kbps" },
  { value: "OGG_22050_16", label: "OGG 22kHz 16-bit" },
  { value: "ULAW_8000_8", label: "u-law 8kHz (telephony)" },
] as const;

export const SAMPLE_TEXTS = [
  { label: "Greeting", text: "السلام علیکم، میں آپ کی کیا مدد کر سکتا ہوں؟" },
  { label: "Weather", text: "آج موسم بہت اچھا ہے، باہر نکلیں اور سیر کریں۔" },
  { label: "Long paragraph", text: "اردو پاکستان کی قومی زبان ہے۔ یہ ایک بہت خوبصورت زبان ہے جو صدیوں سے بولی جا رہی ہے۔ اس زبان میں بے شمار شاعروں اور ادیبوں نے اپنا کلام لکھا ہے۔" },
];
