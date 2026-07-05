# F&B Invoice Manager

A bilingual (简体中文 / English) invoice management web app built for a real Singapore F&B business — multiple food outlets and a central kitchen receiving daily supplier invoices for meat, vegetables, rice, packaging, and more.

Staff photograph paper invoices (or upload emailed PDFs) from their phones. Claude reads them — Chinese, English, or mixed — and extracts the supplier, totals, GST, and every line item into a structured database. The owners review, track spending and ingredient price trends, manage supplier payments, and export monthly figures for their accountant.

## Features

- 📸 **Snap & extract** — photo or PDF upload; AI extraction of full line items via the Anthropic API (Claude Opus 4.8, vision + structured outputs)
- 🌏 **Bilingual UI** — Simplified Chinese / English toggle
- 🏪 **Multi-outlet** — invoices tagged to outlets or the central kitchen, with per-location spending
- 📈 **Price trends** — unit-price tracking per ingredient per supplier, to catch creeping costs
- 💰 **Payment tracking** — paid/unpaid status with due dates auto-computed from supplier credit terms
- 🧮 **Statement reconciliation** — monthly supplier statements (账单) auto-matched against received invoices, flagging missing or mismatched deliveries before payment
- 🧾 **GST-ready exports** — monthly Excel export with GST broken out for the accountant
- 👥 **Roles** — staff upload and correct; admins approve, edit, and see the dashboard

## Stack

Next.js (App Router, TypeScript) on Vercel · Supabase (Postgres, Auth, Storage) · Anthropic API · next-intl

## Status

🚧 In development. Design spec: [docs/superpowers/specs/2026-07-04-invoice-mgmt-design.md](docs/superpowers/specs/2026-07-04-invoice-mgmt-design.md)
