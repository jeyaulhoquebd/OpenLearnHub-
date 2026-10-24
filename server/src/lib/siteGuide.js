const SITE_PAGES = [
  {
    path: '/',
    title: { en: 'Home', bn: 'হোম', ur: 'ہوم' },
    description: {
      en: 'Start with featured learning resources, free-software alternatives, and the main search and browse options.',
      bn: 'নির্বাচিত শেখার রিসোর্স, ফ্রি সফটওয়্যারের বিকল্প এবং মূল সার্চ ও ব্রাউজ অপশন দিয়ে শুরু করুন।',
      ur: 'نمایاں تعلیمی وسائل، مفت سافٹ ویئر کے متبادل اور بنیادی تلاش و براؤز اختیارات سے آغاز کریں۔'
    },
    keywords: 'home homepage start featured alternatives হোম শুরু বিকল্প ہوم آغاز متبادل'
  },
  {
    path: '/explore',
    title: { en: 'Explore resources', bn: 'রিসোর্স ঘুরে দেখুন', ur: 'وسائل دیکھیں' },
    description: {
      en: 'Browse the public library and narrow results by subject, level, language, region, platform, rating, or resource type. Sort results and move through pages.',
      bn: 'বিষয়, স্তর, ভাষা, অঞ্চল, প্ল্যাটফর্ম, রেটিং বা রিসোর্সের ধরন দিয়ে পাবলিক লাইব্রেরি খুঁজুন; ফলাফল সাজান ও পৃষ্ঠা বদলান।',
      ur: 'عوامی لائبریری میں موضوع، سطح، زبان، خطہ، پلیٹ فارم، درجہ بندی یا وسیلے کی قسم سے تلاش اور نتائج ترتیب دیں۔'
    },
    keywords: 'explore browse filter filters category subject level language region country platform rating sort results ঘুরে দেখুন খুঁজুন ফিল্টার বিষয় স্তর ভাষা অঞ্চল রেটিং تلاش کریں فلٹر موضوع سطح زبان علاقہ'
  },
  {
    path: '/courses',
    title: { en: 'Free courses', bn: 'ফ্রি কোর্স', ur: 'مفت کورسز' },
    description: {
      en: 'See courses in the library. Open a course card for details and, when available, use the on-site player for supported YouTube lessons.',
      bn: 'লাইব্রেরির কোর্স দেখুন। বিস্তারিত জানতে কোর্স কার্ড খুলুন; সমর্থিত ইউটিউব পাঠ সাইটের প্লেয়ারে দেখা যায়।',
      ur: 'لائبریری کے کورسز دیکھیں۔ تفصیل کے لیے کارڈ کھولیں؛ معاون یوٹیوب اسباق سائٹ کے پلیئر میں چلائے جا سکتے ہیں۔'
    },
    keywords: 'course courses class lesson video youtube player কোর্স ক্লাস পাঠ ভিডিও کورس سبق ویڈیو'
  },
  {
    path: '/books',
    title: { en: 'Lawful free books', bn: 'বৈধ ফ্রি বই', ur: 'قانونی مفت کتابیں' },
    description: {
      en: 'Browse books that are public-domain, openly licensed, or freely shared by their author or publisher. Open a listing to check its source and licence.',
      bn: 'পাবলিক ডোমেইন, উন্মুক্ত লাইসেন্সে প্রকাশিত বা লেখক/প্রকাশকের দেওয়া ফ্রি বই দেখুন। উৎস ও লাইসেন্স জানতে তালিকা খুলুন।',
      ur: 'عوامی ملکیت، کھلے لائسنس یا مصنف/ناشر کی جانب سے مفت دستیاب کتابیں دیکھیں اور ماخذ و لائسنس جانچیں۔'
    },
    keywords: 'book books textbook ebook pdf license licence copyright public domain বই পিডিএফ লাইসেন্স বই کتاب پی ڈی ایف لائسنس'
  },
  {
    path: '/software',
    title: { en: 'Open-source software', bn: 'ওপেন-সোর্স সফটওয়্যার', ur: 'اوپن سورس سافٹ ویئر' },
    description: {
      en: 'Find free and open-source tools and alternatives. Listings point to official publisher websites; OpenLearn Hub does not host installers.',
      bn: 'ফ্রি ও ওপেন-সোর্স টুল এবং বিকল্প খুঁজুন। তালিকা অফিসিয়াল প্রকাশকের সাইটে নিয়ে যায়; এখানে ইনস্টলার রাখা হয় না।',
      ur: 'مفت اور اوپن سورس ٹولز اور متبادل دیکھیں۔ فہرستیں سرکاری ناشر کی سائٹ پر جاتی ہیں؛ انسٹالر یہاں میزبانی نہیں کیے جاتے۔'
    },
    keywords: 'software app tool tools install download open source alternative gimp libreoffice সফটওয়্যার টুল ইনস্টল ডাউনলোড বিকল্প سافٹ ویئر ٹول انسٹال ڈاؤن لوڈ متبادل'
  },
  {
    path: '/search',
    title: { en: 'Search the library', bn: 'লাইব্রেরিতে খুঁজুন', ur: 'لائبریری میں تلاش' },
    description: {
      en: 'Search courses, books, and software together, then filter results by type.',
      bn: 'কোর্স, বই ও সফটওয়্যার একসাথে খুঁজুন, এরপর ধরন অনুযায়ী ফলাফল বাছুন।',
      ur: 'کورسز، کتابیں اور سافٹ ویئر ایک ساتھ تلاش کریں، پھر قسم کے لحاظ سے نتائج چھانٹیں۔'
    },
    keywords: 'search find query keyword results lookup খোঁজ খুঁজুন সার্চ تلاش کریں سرچ نتائج'
  },
  {
    path: '/assistant',
    title: { en: 'LearnMate AI', bn: 'LearnMate এআই', ur: 'LearnMate AI' },
    description: {
      en: 'Ask about public pages and features, get recommendations grounded in published library resources, or build a step-by-step study roadmap. Chat requires sign-in; roadmaps also require a verified email.',
      bn: 'পাবলিক পেজ ও ফিচার সম্পর্কে জিজ্ঞাসা করুন, প্রকাশিত লাইব্রেরি রিসোর্স থেকে সুপারিশ নিন বা ধাপে ধাপে পড়ার রোডম্যাপ তৈরি করুন। চ্যাটে সাইন ইন এবং রোডম্যাপে যাচাইকৃত ইমেইল দরকার।',
      ur: 'عوامی صفحات اور خصوصیات کے بارے میں پوچھیں، شائع شدہ وسائل سے تجاویز لیں یا مرحلہ وار روڈ میپ بنائیں۔ چیٹ کے لیے سائن اِن اور روڈ میپ کے لیے تصدیق شدہ ای میل درکار ہے۔'
    },
    keywords: 'ai assistant learnmate roadmap study plan chatbot help ask এআই সহকারী রোডম্যাপ পরিকল্পনা مدد اے آئی معاون روڈ میپ منصوبہ مدد'
  },
  {
    path: '/dashboard',
    title: { en: 'Your learning dashboard', bn: 'আপনার শেখার ড্যাশবোর্ড', ur: 'آپ کا تعلیمی ڈیش بورڈ' },
    description: {
      en: 'Signed-in learners can view their own saved resources, progress, reviews, submissions, and account settings. LearnMate cannot access or disclose this personal data.',
      bn: 'সাইন-ইন করা শিক্ষার্থীরা নিজেদের সংরক্ষিত রিসোর্স, অগ্রগতি, রিভিউ, জমা দেওয়া রিসোর্স ও অ্যাকাউন্ট সেটিংস দেখতে পারেন। LearnMate এই ব্যক্তিগত তথ্য দেখতে বা প্রকাশ করতে পারে না।',
      ur: 'سائن اِن شدہ سیکھنے والے اپنے محفوظ وسائل، پیش رفت، جائزے، جمع کرائی گئی تجاویز اور اکاؤنٹ کی ترتیبات دیکھ سکتے ہیں۔ LearnMate اس نجی ڈیٹا تک رسائی یا اسے ظاہر نہیں کر سکتا۔'
    },
    keywords: 'dashboard saved bookmark progress review submission account my library ড্যাশবোর্ড সংরক্ষিত বুকমার্ক অগ্রগতি অ্যাকাউন্ট ڈیش بورڈ محفوظ پیش رفت اکاؤنٹ'
  },
  {
    path: '/signup',
    title: { en: 'Create an account', bn: 'অ্যাকাউন্ট তৈরি করুন', ur: 'اکاؤنٹ بنائیں' },
    description: {
      en: 'Create a free learner account to save resources, track progress, submit suggestions, and use LearnMate. Email sign-up may require address verification.',
      bn: 'রিসোর্স সংরক্ষণ, অগ্রগতি দেখা, প্রস্তাব জমা ও LearnMate ব্যবহারের জন্য ফ্রি শিক্ষার্থী অ্যাকাউন্ট তৈরি করুন। ইমেইলে সাইন আপ করলে ঠিকানা যাচাই লাগতে পারে।',
      ur: 'وسائل محفوظ کرنے، پیش رفت دیکھنے، تجاویز دینے اور LearnMate استعمال کرنے کے لیے مفت اکاؤنٹ بنائیں۔ ای میل سائن اپ کے لیے پتے کی تصدیق درکار ہو سکتی ہے۔'
    },
    keywords: 'signup sign up register create account join account registration সাইন আপ নিবন্ধন অ্যাকাউন্ট তৈরি اکاؤنٹ بنائیں رجسٹر'
  },
  {
    path: '/login',
    title: { en: 'Sign in', bn: 'সাইন ইন', ur: 'سائن اِن' },
    description: {
      en: 'Sign in with email and password or an enabled social provider to access learner features.',
      bn: 'শিক্ষার্থীদের ফিচার ব্যবহার করতে ইমেইল-পাসওয়ার্ড বা চালু থাকা সোশ্যাল প্রোভাইডার দিয়ে সাইন ইন করুন।',
      ur: 'سیکھنے والوں کی خصوصیات کے لیے ای میل اور پاس ورڈ یا دستیاب سوشل فراہم کنندہ سے سائن اِن کریں۔'
    },
    keywords: 'login log in sign in signin authentication google github apple সাইন ইন লগইন لاگ اِن سائن ان'
  },
  {
    path: '/forgot-password',
    title: { en: 'Reset your password', bn: 'পাসওয়ার্ড রিসেট করুন', ur: 'پاس ورڈ ری سیٹ کریں' },
    description: {
      en: 'Request a password reset email from the sign-in page if you cannot access your password.',
      bn: 'পাসওয়ার্ড মনে না থাকলে সাইন-ইন পেজ থেকে পাসওয়ার্ড রিসেট ইমেইল পাঠান।',
      ur: 'پاس ورڈ بھول جانے پر سائن اِن صفحے سے پاس ورڈ ری سیٹ ای میل منگوائیں۔'
    },
    keywords: 'forgot password reset recover account পাসওয়ার্ড ভুল রিসেট পুনরুদ্ধার پاس ورڈ بھول ری سیٹ'
  },
  {
    path: '/submit',
    title: { en: 'Suggest a resource', bn: 'রিসোর্স প্রস্তাব করুন', ur: 'وسیلہ تجویز کریں' },
    description: {
      en: 'Signed-in learners can suggest a lawful free resource for human review. Submissions are not public until approved.',
      bn: 'সাইন-ইন করা শিক্ষার্থীরা বৈধ ফ্রি রিসোর্স মানব পর্যালোচনার জন্য প্রস্তাব করতে পারেন। অনুমোদনের আগে প্রস্তাব প্রকাশিত হয় না।',
      ur: 'سائن اِن شدہ سیکھنے والے قانونی مفت وسیلہ انسانی جائزے کے لیے تجویز کر سکتے ہیں۔ منظوری سے پہلے تجاویز عوامی نہیں ہوتیں۔'
    },
    keywords: 'submit suggest contribute add resource submission approve review জমা প্রস্তাব যোগ রিভিউ منظوری تجویز جمع'
  },
  {
    path: '/about',
    title: { en: 'About OpenLearn Hub', bn: 'ওপেনলার্ন হাব সম্পর্কে', ur: 'اوپن لرن ہب کے بارے میں' },
    description: {
      en: 'Learn about the project, its audience, and its commitment to lawful, free learning resources.',
      bn: 'প্রকল্প, এর শিক্ষার্থী এবং বৈধ ফ্রি শেখার রিসোর্সের প্রতি অঙ্গীকার সম্পর্কে জানুন।',
      ur: 'منصوبے، اس کے سیکھنے والوں اور قانونی مفت تعلیمی وسائل کے عزم کے بارے میں جانیں۔'
    },
    keywords: 'about project mission who maintainer পরিচিতি প্রকল্প সম্পর্কে تعارف منصوبہ'
  },
  {
    path: '/contact',
    title: { en: 'Contact', bn: 'যোগাযোগ', ur: 'رابطہ' },
    description: {
      en: 'Find the public contact page for questions, feedback, and general enquiries.',
      bn: 'প্রশ্ন, মতামত ও সাধারণ যোগাযোগের জন্য পাবলিক যোগাযোগ পেজ দেখুন।',
      ur: 'سوالات، رائے اور عمومی استفسارات کے لیے عوامی رابطہ صفحہ دیکھیں۔'
    },
    keywords: 'contact email feedback question support যোগাযোগ ইমেইল মতামত سوال رابطہ ای میل رائے'
  },
  {
    path: '/legal/copyright',
    title: { en: 'Copyright policy', bn: 'কপিরাইট নীতি', ur: 'کاپی رائٹ پالیسی' },
    description: {
      en: 'Read the copyright policy and how to report copyright concerns.',
      bn: 'কপিরাইট নীতি এবং কপিরাইট-সংক্রান্ত উদ্বেগ জানানোর পদ্ধতি পড়ুন।',
      ur: 'کاپی رائٹ پالیسی اور کاپی رائٹ سے متعلق خدشات رپورٹ کرنے کا طریقہ پڑھیں۔'
    },
    keywords: 'copyright dmca piracy report legal rights কপিরাইট পাইরেসি রিপোর্ট قانونی کاپی رائٹ رپورٹ قانونی'
  },
  {
    path: '/legal/terms',
    title: { en: 'Terms of use', bn: 'ব্যবহারের শর্তাবলি', ur: 'استعمال کی شرائط' },
    description: {
      en: 'Review the terms that apply when using OpenLearn Hub.',
      bn: 'ওপেনলার্ন হাব ব্যবহারের প্রযোজ্য শর্তাবলি দেখুন।',
      ur: 'اوپن لرن ہب استعمال کرنے کی شرائط دیکھیں۔'
    },
    keywords: 'terms conditions rules use policy শর্তাবলি নিয়ম استعمال شرائط قوانین'
  },
  {
    path: '/legal/privacy',
    title: { en: 'Privacy policy', bn: 'গোপনীয়তা নীতি', ur: 'رازداری کی پالیسی' },
    description: {
      en: 'Read what the privacy policy says about information and account data.',
      bn: 'তথ্য ও অ্যাকাউন্ট ডেটা সম্পর্কে গোপনীয়তা নীতিতে কী বলা আছে পড়ুন।',
      ur: 'معلومات اور اکاؤنٹ ڈیٹا کے بارے میں رازداری پالیسی پڑھیں۔'
    },
    keywords: 'privacy personal information data security গোপনীয়তা ব্যক্তিগত তথ্য ডেটা رازداری ذاتی معلومات ڈیٹا'
  }
];

const LOCALE_NAMES = { en: 'English', bn: 'Bangla', ur: 'Urdu' };
const STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'before', 'between',
  'but', 'can', 'could', 'did', 'does', 'for', 'from', 'give', 'help', 'how',
  'into', 'is', 'it', 'its', 'just', 'me', 'more', 'much', 'my', 'need', 'not',
  'please', 'should', 'show', 'short', 'some', 'tell', 'than', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'to', 'two', 'use', 'using', 'very', 'want', 'was', 'what', 'when', 'where',
  'which', 'while', 'who', 'why', 'with', 'would', 'you', 'your', 'explain',
  'sentence', 'sentences', 'define', 'meaning'
]);

function normalizedLocale(locale = 'en') {
  const shortLocale = String(locale).slice(0, 2);
  return SITE_PAGES[0].title[shortLocale] ? shortLocale : 'en';
}

function words(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function scorePage(page, queryTerms, locale) {
  const searchable = new Set(
    words(
      [
        page.path,
        page.keywords,
        page.title[locale],
        page.description[locale],
        page.title.en,
        page.description.en
      ].join(' ')
    )
  );
  return queryTerms.reduce((score, term) => score + (searchable.has(term) ? 1 : 0), 0);
}

/** Returns public website pages only; private account data and admin pages are excluded. */
export function findRelevantSitePages(userText, locale = 'en', max = 3) {
  const language = normalizedLocale(locale);
  if (
    /\badmin(istrator)?\b|admin dashboard|moderation (dashboard|queue)|site settings|অ্যাডমিন|প্রশাসক|মডারেশন|ایڈمن|انتظامی ڈیش بورڈ/i.test(
      String(userText)
    )
  ) {
    return [];
  }
  const terms = words(userText);
  const ranked = SITE_PAGES.map((page, index) => ({
    page,
    index,
    score: scorePage(page, terms, language)
  }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.min(Math.max(Number(max) || 3, 1), 5));

  return ranked.map(({ page }) => ({
    path: page.path,
    title: page.title[language],
    description: page.description[language]
  }));
}

/** Compact, public-only site documentation for LearnMate grounding. */
export function formatPublicSiteGuide(locale = 'en') {
  const language = normalizedLocale(locale);
  return [
    `Website guide language: ${LOCALE_NAMES[language]}.`,
    ...SITE_PAGES.map(
      (page) =>
        `- ${page.title[language]} (${page.path}): ${page.description[language]}`
    )
  ].join('\n');
}
