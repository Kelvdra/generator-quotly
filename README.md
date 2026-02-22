# Quotly Canvas Generator (Next.js)

Website generator "quotly chat" pakai HTML Canvas (tanpa API), siap deploy ke Vercel.

## Run lokal
```bash
npm install
npm run dev
```

## Deploy Vercel
- Push repo ke GitHub
- Import di Vercel -> Deploy

## Catatan CORS
Avatar/media URL diproxy lewat `/api/image?url=...` supaya canvas aman diexport.
