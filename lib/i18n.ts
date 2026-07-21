"use client";

import { useSyncExternalStore } from "react";

/**
 * Lightweight client-side i18n for the site chrome and landing.
 *
 * A module-level store (no React context) holds the chosen locale, backed by
 * localStorage and broadcast so every component re-renders on change. This
 * covers the marketing surface — the part a newcomer reads first — in a
 * curated set of major world languages.
 *
 * Deliberately scoped: the advisory text (spray/drying/frost guidance) stays in
 * reviewed English for now. Auto-translating safety-relevant advice into dozens
 * of languages without review is a real hazard, so coverage grows deliberately
 * rather than machine-generating the long tail.
 */

export const LOCALES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "pt", label: "Português", dir: "ltr" },
  { code: "sw", label: "Kiswahili", dir: "ltr" },
  { code: "hi", label: "हिन्दी", dir: "ltr" },
  { code: "bn", label: "বাংলা", dir: "ltr" },
  { code: "id", label: "Bahasa Indonesia", dir: "ltr" },
  { code: "zh", label: "中文", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

type Dict = Record<string, string>;

const MESSAGES: Record<Locale, Dict> = {
  en: {
    "nav.how": "How it works",
    "nav.demo": "Demo",
    "nav.developers": "Developers",
    "nav.start": "Start your farm",
    "hero.badge": "A weather companion for a working farm",
    "hero.title": "Your season, one field at a time.",
    "hero.subtitle":
      "Seasonwise turns the forecast into the decisions that move a season — when to dry, when to spray, and what each field needs — tuned to its crop, stage, and history.",
    "hero.startFree": "Start your farm — free",
    "hero.seeDemo": "See the live demo",
    "hero.noSignup": "No sign-up. Works on a cheap phone.",
  },
  es: {
    "nav.how": "Cómo funciona",
    "nav.demo": "Demostración",
    "nav.developers": "Desarrolladores",
    "nav.start": "Crea tu finca",
    "hero.badge": "Un compañero meteorológico para tu finca",
    "hero.title": "Tu temporada, campo por campo.",
    "hero.subtitle":
      "Seasonwise convierte el pronóstico en las decisiones que marcan la temporada — cuándo secar, cuándo fumigar y qué necesita cada campo — según su cultivo, etapa e historial.",
    "hero.startFree": "Crea tu finca — gratis",
    "hero.seeDemo": "Ver la demostración",
    "hero.noSignup": "Sin registro. Funciona en un teléfono sencillo.",
  },
  fr: {
    "nav.how": "Comment ça marche",
    "nav.demo": "Démo",
    "nav.developers": "Développeurs",
    "nav.start": "Créer votre ferme",
    "hero.badge": "Un compagnon météo pour votre ferme",
    "hero.title": "Votre saison, un champ à la fois.",
    "hero.subtitle":
      "Seasonwise transforme les prévisions en décisions qui comptent — quand sécher, quand traiter, et ce dont chaque champ a besoin — selon sa culture, son stade et son histoire.",
    "hero.startFree": "Créer votre ferme — gratuit",
    "hero.seeDemo": "Voir la démo",
    "hero.noSignup": "Sans inscription. Fonctionne sur un téléphone modeste.",
  },
  pt: {
    "nav.how": "Como funciona",
    "nav.demo": "Demonstração",
    "nav.developers": "Programadores",
    "nav.start": "Crie a sua fazenda",
    "hero.badge": "Um companheiro meteorológico para a sua fazenda",
    "hero.title": "A sua safra, um campo de cada vez.",
    "hero.subtitle":
      "O Seasonwise transforma a previsão nas decisões que movem a safra — quando secar, quando pulverizar e o que cada campo precisa — conforme a cultura, o estágio e o histórico.",
    "hero.startFree": "Crie a sua fazenda — grátis",
    "hero.seeDemo": "Ver a demonstração",
    "hero.noSignup": "Sem cadastro. Funciona num telefone simples.",
  },
  sw: {
    "nav.how": "Jinsi inavyofanya kazi",
    "nav.demo": "Onyesho",
    "nav.developers": "Wasanidi",
    "nav.start": "Anzisha shamba lako",
    "hero.badge": "Mwenzako wa hali ya hewa shambani",
    "hero.title": "Msimu wako, shamba moja kwa wakati.",
    "hero.subtitle":
      "Seasonwise hubadilisha utabiri kuwa maamuzi muhimu ya msimu — lini kukausha, lini kunyunyiza, na kila shamba linahitaji nini — kulingana na zao, hatua na historia yake.",
    "hero.startFree": "Anzisha shamba — bila malipo",
    "hero.seeDemo": "Tazama onyesho",
    "hero.noSignup": "Hakuna usajili. Hufanya kazi kwa simu ya bei nafuu.",
  },
  hi: {
    "nav.how": "यह कैसे काम करता है",
    "nav.demo": "डेमो",
    "nav.developers": "डेवलपर",
    "nav.start": "अपना खेत शुरू करें",
    "hero.badge": "खेती के लिए एक मौसम साथी",
    "hero.title": "आपका मौसम, एक-एक खेत।",
    "hero.subtitle":
      "Seasonwise पूर्वानुमान को उन फैसलों में बदलता है जो मौसम तय करते हैं — कब सुखाना है, कब छिड़काव करना है, और हर खेत को क्या चाहिए — उसकी फसल, अवस्था और इतिहास के अनुसार।",
    "hero.startFree": "अपना खेत शुरू करें — मुफ़्त",
    "hero.seeDemo": "लाइव डेमो देखें",
    "hero.noSignup": "कोई साइन-अप नहीं। साधारण फ़ोन पर चलता है।",
  },
  bn: {
    "nav.how": "কীভাবে কাজ করে",
    "nav.demo": "ডেমো",
    "nav.developers": "ডেভেলপার",
    "nav.start": "আপনার খামার শুরু করুন",
    "hero.badge": "খামারের জন্য একটি আবহাওয়া সঙ্গী",
    "hero.title": "আপনার মৌসুম, একটি করে জমি।",
    "hero.subtitle":
      "Seasonwise পূর্বাভাসকে মৌসুমের গুরুত্বপূর্ণ সিদ্ধান্তে রূপ দেয় — কখন শুকাতে হবে, কখন স্প্রে করতে হবে, আর প্রতিটি জমির কী প্রয়োজন — ফসল, পর্যায় ও ইতিহাস অনুযায়ী।",
    "hero.startFree": "খামার শুরু করুন — বিনামূল্যে",
    "hero.seeDemo": "লাইভ ডেমো দেখুন",
    "hero.noSignup": "সাইন-আপ নেই। সাধারণ ফোনেও চলে।",
  },
  id: {
    "nav.how": "Cara kerja",
    "nav.demo": "Demo",
    "nav.developers": "Pengembang",
    "nav.start": "Mulai lahan Anda",
    "hero.badge": "Pendamping cuaca untuk lahan pertanian",
    "hero.title": "Musim Anda, satu lahan demi lahan.",
    "hero.subtitle":
      "Seasonwise mengubah prakiraan menjadi keputusan penting semusim — kapan mengeringkan, kapan menyemprot, dan apa yang dibutuhkan tiap lahan — sesuai tanaman, tahap, dan riwayatnya.",
    "hero.startFree": "Mulai lahan — gratis",
    "hero.seeDemo": "Lihat demo langsung",
    "hero.noSignup": "Tanpa pendaftaran. Berjalan di ponsel sederhana.",
  },
  zh: {
    "nav.how": "工作原理",
    "nav.demo": "演示",
    "nav.developers": "开发者",
    "nav.start": "创建你的农场",
    "hero.badge": "为农田而生的天气助手",
    "hero.title": "你的农季，一块田一块田地照看。",
    "hero.subtitle":
      "Seasonwise 把天气预报变成决定农季的关键抉择——何时晾晒、何时喷药、每块田需要什么——依据作物、生长阶段和历史。",
    "hero.startFree": "免费创建农场",
    "hero.seeDemo": "查看在线演示",
    "hero.noSignup": "无需注册。低配手机也能用。",
  },
  ar: {
    "nav.how": "كيف يعمل",
    "nav.demo": "عرض توضيحي",
    "nav.developers": "المطوّرون",
    "nav.start": "ابدأ مزرعتك",
    "hero.badge": "رفيق الطقس لمزرعتك",
    "hero.title": "موسمك، حقلاً تلو الآخر.",
    "hero.subtitle":
      "يحوّل Seasonwise توقّعات الطقس إلى قرارات تصنع الموسم — متى تُجفّف، ومتى تَرشّ، وما يحتاجه كل حقل — وفق محصوله ومرحلته وتاريخه.",
    "hero.startFree": "ابدأ مزرعتك — مجانًا",
    "hero.seeDemo": "شاهد العرض المباشر",
    "hero.noSignup": "بدون تسجيل. يعمل على هاتف بسيط.",
  },
};

const STORAGE_KEY = "seasonwise.locale";
let current: Locale = "en";
const listeners = new Set<() => void>();

function isLocale(v: string): v is Locale {
  return LOCALES.some((l) => l.code === v);
}

/** Read persisted locale on first use (client only). */
function init() {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isLocale(stored)) current = stored;
  } catch {
    /* ignore */
  }
}
init();

export function getLocale(): Locale {
  return current;
}

export function setLocale(code: Locale) {
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  const dir = LOCALES.find((l) => l.code === code)?.dir ?? "ltr";
  document.documentElement.lang = code;
  document.documentElement.dir = dir;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Translate a key for the current locale, falling back to English. */
export function useT(): (key: string) => string {
  const locale = useSyncExternalStore(
    subscribe,
    () => current,
    () => "en" as Locale,
  );
  return (key: string) => MESSAGES[locale]?.[key] ?? MESSAGES.en[key] ?? key;
}
