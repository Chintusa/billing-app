# Smart Bill — Modern Point of Sale & Billing Software

> **Fast, Offline-First & Professional POS Billing Application** tailored for retail shops, apparel stores, and commercial businesses. Built with **React 19**, **TypeScript**, **Vite 6**, **Tailwind CSS v4**, and **Node.js/Express**.

---

## 🌟 Key Features

### ⚡ Lightning-Fast POS Billing
* **Full Keyboard Navigation**: Complete transaction workflows using standard POS keyboard shortcuts (`F2`, `Ctrl+P`, `Ctrl+S`, `Ctrl+N`, `Ctrl+H`, `Esc`).
* **Dynamic Multi-Stage Discounts**: Flexible percentage and compound discounts (e.g. `50+4%`, `10%`, flat amounts).
* **Multi-Phone Support**: Enter multiple customer contacts with commas (`,`), hyphens (`-`), country codes (`+91`), and spaces.
* **Home Delivery Billing**: One-click delivery charge add-on with pre-configurable default fees that automatically roll into the grand total.

### 🖨️ Precision Multi-Format Printing Engine
* **Universal Paper Sizes**: Fully calibrated print layouts for:
  * **A4 Standard Sheet** (Full-size tax invoices)
  * **A5 Half Sheet** (Compact receipts)
  * **A6 Quarter Sheet** (Laser printers like HP LaserJet Pro P110 with zero roller-edge clipping)
  * **80mm POS Thermal Roll**
  * **58mm Mini POS Thermal Roll**
* **Zero Text Clipping & Overlapping**: Anti-collision column styling and safe printer hardware margins.
* **Windows Print Settings Integration**: Full access to the native Windows print preview layout (Portrait / Landscape) dropdown.

### 📄 Pure Vector Client-Side PDF Generation
* Instant, high-resolution vector PDF invoice creation without server dependencies or character corruption.
* Works seamlessly across modern desktop browsers and mobile devices.

### 💬 WhatsApp Invoice Dispatching
* **Direct WhatsApp Share (Works Everywhere)**: 100% free with zero backend setup. Opens WhatsApp Web or mobile app with pre-filled, itemized bill text and store branding.
* **Local WhatsApp QR Gateway**: Optional background Node.js service allowing silent PDF invoice sending directly from your linked store WhatsApp.

### 📢 Dynamic Marketing Footer & Promotional Notes
* Add promotional notes, festival greetings, loyalty program reminders, return policies, or store announcements directly onto printed receipts and PDFs.
* Active note management with real-time bill previews and category filters.

### 🚀 One-Click Windows Desktop Launcher
* **No Terminal Required**: Non-technical cashiers can double-click **`Smart-Bill.bat`** (or a Desktop shortcut) to automatically launch the background services, check server readiness, and open the browser.
* **Smart Duplicate Prevention**: Detects if the server is already active and brings up the window instantly without spawning duplicate background processes.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`F2`** or **`Ctrl + N`** | Start a New Bill (Clear Form) |
| **`Ctrl + P`** | Print Bill to Printer |
| **`Ctrl + S`** | Save Bill & Form / Save Settings |
| **`Ctrl + H`** | Open Bill History & Search |
| **`Esc`** | Close Modals & Dialogs |
| **`Enter`** | Add New Line Item / Advance Focus |

---

## 🛠️ Technology Stack

* **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide Icons, Motion
* **Backend / Gateway**: Node.js, Express, Baileys WhatsApp Gateway, PDFKit, esbuild
* **Storage**: LocalStorage (Offline-First Persistent DB)

---

## 🚀 Getting Started

### Prerequisites
* [Node.js (LTS version)](https://nodejs.org) installed on your system.

### 1. Clone the Repository
```bash
git clone https://github.com/Chintusa/billing-app.git
cd billing-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```
Open your browser at **`http://localhost:3000`**.

### 4. Run Electron Desktop in Development
```bash
npm run electron:dev
```

### 5. Package Windows Desktop Installer (.exe)
```bash
npm run electron:build
```
The installer will be generated in `release/Smart Bill - Billing Software Setup 1.0.0.exe`.

---

## 🖥️ Production Desktop Modes

### Option A: Native Windows Installed App (Recommended)
1. Run `npm run electron:build` (or distribute `release/Smart Bill - Billing Software Setup 1.0.0.exe`).
2. Run the installer on any Windows PC.
3. It installs to the system, creates Desktop & Start Menu shortcuts, and runs **completely self-contained without Node.js or browser installations**.

### Option B: Quick Batch Launcher (Developer / Portable)
1. Double-click **`Create-Desktop-Shortcut.bat`** inside the project folder.
2. A shortcut named **`Smart Bill - Billing Software`** will be placed on your Windows Desktop.
3. Simply double-click the shortcut anytime to launch the software.

To stop the background server:
* Run **`Stop-Smart-Bill.bat`** to safely terminate running services on port 3000.

---

## 📁 Project Structure

```text
├── src/
│   ├── components/       # UI Views (NewBillView, HistoryView, SettingsView, WhatsAppModal, Header)
│   ├── services/         # Business logic (billing, printService, pdfService, whatsappService, db)
│   ├── types.ts          # TypeScript interfaces & data models
│   ├── App.tsx           # Main application shell & tab routing
│   └── main.tsx          # React application entry point
├── server.ts             # Express & Baileys local WhatsApp gateway
├── vite.config.ts        # Vite build & Tailwind CSS configuration
├── Smart-Bill.bat        # One-click Windows application launcher
├── Create-Desktop-Shortcut.bat  # Automated desktop shortcut creator
├── Stop-Smart-Bill.bat   # Process terminator for port 3000
└── dist/                 # Production bundled server and frontend assets
```

---

## 👨‍💻 Credits & Attribution

Crafted by **[Code N Pixels](https://codenpixels.in)**.