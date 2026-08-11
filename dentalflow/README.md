# 🦷 DentalFlow Pro — Dental Clinic Management System

Nidaam maamul oo dhamaystiran oo rugaha ilkaha loogu talagalay — **hal goob** oo aad kaga maamusho
bukaanka, ballamaha, daaweynta, raajada, qaansheegyada, alaabta iyo warbixinnada.
UI/UX casri ah, ku shaqeeya mobile iyo desktop, wuxuuna leeyahay **Dark / Light mode** iyo
**luqad laba-geesood ah: English & Soomaali**.

> A complete dental clinic management platform — everything in one place, with a modern,
> responsive UI, dark/light themes and English/Somali interface switching.

---

## 🚀 Sida loo furo / How to run

Ma jiro build, ma jiraan dependencies — kaliya fur faylka:

```bash
# si toos ah
open dentalflow/index.html

# ama server maxalli ah
cd dentalflow && python3 -m http.server 8080
# → http://localhost:8080
```

Xogtu waa **muunad (demo data)** oo ku jirta `js/data.js` — beddel si aad u isticmaasho xogtaada.

---

## 📦 Modules (16)

| Qaybta | Waxa ay qabato |
|---|---|
| **Dashboard** | KPI cards, dakhliga bishii, guudmarka daaweynta, ballamaha, xaaladda kuraasta, dhaqdhaqaaqa tooska ah, digniinta alaabta |
| **Patients** | Diiwaanka bukaanka, raadin, kala sooc, caymis, deyn, taariikhda booqashada |
| **Dentists** | Astaamaha dhakhaatiirta, takhasuska, jadwalka, qiimaynta |
| **Appointments** | Ballan-qabsi, kursi + dhakhtar + waqti, xaalado (Confirmed / In Progress / Upcoming / Cancelled) |
| **Dental Chairs** | Shaxda tooska ah ee kuraasta iyo boqolkiiba isticmaalka |
| **Treatments** | Qorshayaal daaweyn, ilig (FDI), sessions, horumar, kharash |
| **Odontogram** | Shax ilko oo la gujin karo (32 ilig) — beddel xaaladda, ku dar qoraal, eeg taariikhda |
| **X-Ray Center** | Raajooyinka, nooca (Periapical / Panoramic / Bitewing), timeline |
| **Prescriptions** | Daawooyinka, mudada, digniin xasaasiyad |
| **Lab Requests** | Codsiyada shaybaarka dibadda, taariikhda gudbinta iyo xilliga la filayo |
| **Invoices** | Qaansheegyo, caymis, xaalad bixin, lacag hadhay |
| **Payments** | Cash, Card, Mobile Money, Insurance — tixraac & xaalad |
| **Inventory** | Alaabta, heerka kaydka, digniin yaraansho, taariikhda dhicitaanka |
| **Staff** | Shaqaalaha, doorka, shifka, xaaladda |
| **Reports** | Dakhli vs kharash, adeegyada ugu badan, da'da bukaanka, habka bixinta, KPIs |
| **Settings** | Astaanta rugta, ogeysiisyo, amni & backup, biilal, muuqaal |

---

## 🎨 Design system

- **Brand:** navy `#061436` → blue `#2563eb` → cyan `#22d3ee`
- **Typography:** Plus Jakarta Sans (variable font, la keydiyay gudaha — offline-safe)
- **Themes:** light + dark (token-based, `data-theme` on `<html>`)
- **Icons:** 40+ inline SVG icons — ma jiro CDN, ma jiro network
- **Charts:** area / donut / bars / ranked / sparkline — dhammaan gacan lagu qoray SVG ah
- **Responsive:** 4-column → 2 → 1; sidebar-ku wuxuu noqdaa drawer ka hooseeya 1080px

Wax **shabakad** ah looma baahna — dhammaan waa self-contained.

---

## 🗂 File structure

```
dentalflow/
├── index.html            # shell-ka
├── css/styles.css        # design system oo dhan (tokens, components, responsive)
├── fonts/                # Plus Jakarta Sans (woff2, embedded)
├── js/
│   ├── data.js           # demo dataset (bukaan, ballan, invoice, alaab…)
│   ├── i18n.js           # EN / SO dictionary
│   ├── ui.js             # icons, charts, tooth glyphs, helpers
│   └── app.js            # router, views, modals, events
└── screenshots/          # sawirrada UI-ga
```

---

## 🔌 Ku xidhista xog dhab ah / Wiring real data

`js/data.js` waa hal shay oo `DF_DATA` la yidhaahdo. Si aad Firebase/API ugu xidho,
beddel oo keliya isha xogta:

```js
const DF_DATA = await fetch('/api/clinic').then(r => r.json());
```

Views-ka oo dhan waa tusaalayaal (pure functions) — `render()` ayaa dib u dhisa UI-ga.

---

## 📸 Screenshots

`screenshots/` — dashboard (light + dark), patients, appointments, odontogram,
chairs, invoices, reports, inventory, dentists, x-ray, settings, mobile.
