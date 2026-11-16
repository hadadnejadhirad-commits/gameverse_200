"use client";

import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";

type Language = "fa" | "en";

const categories = [
  ["Action", "اکشن"],
  ["Adventure", "ماجراجویی"],
  ["RPG", "نقش‌آفرینی"],
  ["Strategy", "استراتژی"],
  ["Puzzle", "معمایی"],
  ["Simulation", "شبیه‌سازی"],
  ["Racing", "مسابقه‌ای"],
  ["Other", "سایر"],
] as const;

function sizeLabel(bytes: number, lang: Language) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPanel({ lang }: { lang: Language }) {
  const en = lang === "en";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [developer, setDeveloper] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [genre, setGenre] = useState("Action");
  const [gameFile, setGameFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview("");
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const chooseGame = (event: ChangeEvent<HTMLInputElement>) => {
    setGameFile(event.currentTarget.files?.[0] ?? null);
    setNotice("");
  };

  const chooseCover = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    if (file && !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      event.currentTarget.value = "";
      setCoverFile(null);
      setNotice(en ? "Use a PNG, JPG or WebP cover image." : "برای کاور از PNG یا JPG یا WebP استفاده کن.");
      return;
    }
    if (file && file.size > 8 * 1024 * 1024) {
      event.currentTarget.value = "";
      setCoverFile(null);
      setNotice(en ? "The cover image must be 8 MB or smaller." : "حجم کاور باید حداکثر ۸ مگابایت باشد.");
      return;
    }
    setCoverFile(file);
    setNotice("");
  };

  const exportDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !description.trim() || !developer.trim() || !gameFile || !coverFile) {
      setNotice(en ? "Complete every field and choose both files." : "همهٔ فیلدها را کامل کن و هر دو فایل را انتخاب کن.");
      return;
    }
    if (!/\.(zip|7z|exe|apk|html|pck)$/i.test(gameFile.name)) {
      setNotice(en ? "Choose a supported game file: ZIP, 7Z, EXE, APK, HTML or PCK." : "فایل بازی باید ZIP، 7Z، EXE، APK، HTML یا PCK باشد.");
      return;
    }

    const draft = {
      schemaVersion: 1,
      brand: "HIREX UNIVERSE",
      status: "draft",
      uploadedToServer: false,
      createdAt: new Date().toISOString(),
      game: {
        title: title.trim(),
        description: description.trim(),
        developer: developer.trim(),
        version: version.trim() || "1.0.0",
        genre,
      },
      files: {
        game: { name: gameFile.name, size: gameFile.size, type: gameFile.type || "application/octet-stream" },
        cover: { name: coverFile.name, size: coverFile.size, type: coverFile.type },
      },
      note: "Metadata only. The selected files remain in the browser and have not been uploaded.",
    };

    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "hirex-game"}-draft.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice(en
      ? "Draft exported. No game file was uploaded; an administrator must connect secure storage before publishing."
      : "پیش‌نویس اطلاعات ذخیره شد. فایل بازی آپلود نشده؛ برای انتشار باید فضای ذخیره‌سازی امن به سایت متصل شود.");
  };

  return (
    <section id="upload" className="section upload-section">
      <div className="sectionhead">
        <div>
          <p className="eyebrow"><i /> {en ? "CREATOR STUDIO" : "استودیوی سازندگان"}</p>
          <h2>{en ? "Upload a game" : "ارسال بازی جدید"}</h2>
        </div>
        <p>{en
          ? "Prepare a game listing, choose its cover and export a review-ready metadata draft."
          : "اطلاعات بازی و کاور را آماده کن و یک پیش‌نویس قابل بررسی برای مدیر سایت بساز."}</p>
      </div>
      <div className="upload-notice">
        <b>{en ? "LOCAL DRAFT MODE" : "حالت آماده‌سازی محلی"}</b>
        <span>{en
          ? "This GitHub Pages version cannot securely receive or publish files. Your selected files stay in this browser; only a JSON description is exported."
          : "این نسخهٔ GitHub Pages نمی‌تواند فایل‌ها را به‌صورت امن دریافت و منتشر کند. فایل‌های انتخاب‌شده در همین مرورگر می‌مانند و فقط اطلاعات بازی به شکل JSON خروجی گرفته می‌شود."}</span>
      </div>
      <form className="upload-form" onSubmit={exportDraft}>
        <div className="upload-fields">
          <label>
            <span>{en ? "Game title" : "نام بازی"}</span>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} required placeholder={en ? "Enter the game name" : "نام بازی را وارد کن"} />
          </label>
          <label>
            <span>{en ? "Developer / creator" : "سازنده / توسعه‌دهنده"}</span>
            <input value={developer} onChange={e => setDeveloper(e.target.value)} maxLength={80} required placeholder={en ? "Studio or creator" : "نام سازنده یا استودیو"} />
          </label>
          <label>
            <span>{en ? "Category" : "دسته‌بندی"}</span>
            <select value={genre} onChange={e => setGenre(e.target.value)}>
              {categories.map(([english, persian]) => <option key={english} value={english}>{en ? english : persian}</option>)}
            </select>
          </label>
          <label>
            <span>{en ? "Version" : "نسخه"}</span>
            <input value={version} onChange={e => setVersion(e.target.value)} maxLength={24} placeholder="1.0.0" />
          </label>
          <label className="upload-wide">
            <span>{en ? "Short game story / description" : "داستان کوتاه / توضیحات بازی"}</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={600} required rows={4} placeholder={en ? "What makes this game worth playing?" : "داستان بازی و دلیل جذاب بودن آن را بنویس"} />
            <small>{description.length}/600</small>
          </label>
          <label className="upload-file">
            <span>{en ? "Game file" : "فایل بازی"}</span>
            <input type="file" accept=".zip,.7z,.exe,.apk,.html,.pck" onChange={chooseGame} required />
            <small>{gameFile ? `${gameFile.name} · ${sizeLabel(gameFile.size, lang)}` : (en ? "ZIP, 7Z, EXE, APK, HTML or PCK" : "ZIP، 7Z، EXE، APK، HTML یا PCK")}</small>
          </label>
          <label className="upload-file">
            <span>{en ? "Game cover" : "تصویر کاور"}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseCover} required />
            <small>{coverFile ? `${coverFile.name} · ${sizeLabel(coverFile.size, lang)}` : (en ? "PNG, JPG or WebP · up to 8 MB" : "PNG، JPG یا WebP · حداکثر ۸ مگابایت")}</small>
          </label>
        </div>
        {coverPreview && <div className="upload-preview"><img src={coverPreview} alt={en ? "Selected cover preview" : "پیش‌نمایش کاور انتخاب‌شده"} /><span>{en ? "Cover preview" : "پیش‌نمایش کاور"}</span></div>}
        <div className="upload-actions">
          <button type="submit">{en ? "EXPORT GAME DRAFT ↓" : "دریافت پیش‌نویس بازی ↓"}</button>
          <button type="reset" className="upload-reset" onClick={() => { setTitle(""); setDescription(""); setDeveloper(""); setVersion("1.0.0"); setGenre("Action"); setGameFile(null); setCoverFile(null); setNotice(""); }}>{en ? "CLEAR FORM" : "پاک کردن فرم"}</button>
        </div>
        {notice && <p className="upload-status" role="status">{notice}</p>}
      </form>
    </section>
  );
}
