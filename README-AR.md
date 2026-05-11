# War News Arabic — جاهز للنشر على Render

## تشغيل على Mac
```bash
npm install
npm start
```
ثم افتح:
```text
http://localhost:3000
```

## نشر مجاني على Render
1. ارفع هذا المجلد على GitHub.
2. افتح Render.com.
3. New + ثم Web Service.
4. اختَر Repository.
5. الإعدادات تكون تلقائية بسبب ملف render.yaml.

إذا طلب Render منك القيم يدويًا:
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/news`

## روابط فحص
- `/api/news` للأخبار
- `/api/breaking` للعاجل
- `/api/debug` لفحص المصادر
- `/api/markets` للاقتصاد

## ملاحظة
الخطة المجانية في Render ممكن تنام بعد فترة عدم استخدام، وترجع تفتح بعد أول زيارة. هذا طبيعي في المجاني.
