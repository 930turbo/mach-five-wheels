// api/mail.js
import nodemailer from "nodemailer";
import Busboy from "busboy";
import { parse as parseQS } from "querystring";

/** ---------- Next/Vercel API Config (Node runtime, raw stream) ---------- */
export const config = {
  api: {
    bodyParser: false,     // Let Busboy read the raw stream
    sizeLimit: "12mb",     // Adjust if you need larger total payloads
  },
};

/** ---------- Config ---------- */
const MAX_FILES = 8;
const MAX_FILE_MB = 10; // per file
const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** ---------- Utils ---------- */
const sanitize = (s = "") => String(s).replace(/[\r\n]+/g, " ").trim();
const isEmail = (e = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Parse multipart/form-data with Busboy into { fields, attachments } */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: {
        files: MAX_FILES,
        fileSize: MAX_FILE_MB * 1024 * 1024,
      },
    });

    const fields = {};
    const attachments = [];
    let fileCount = 0;
    let aborted = false;

    bb.on("field", (name, val) => {
      // For repeated fields, keep the last one (simple form semantics)
      fields[name] = val;
    });

    bb.on("file", (name, file, info) => {
      if (aborted) {
        file.resume();
        return;
      }
      if (fileCount >= MAX_FILES) {
        file.resume(); // discard extras silently
        return;
      }

      const { filename, mimeType } = info;

      // Validate type early
      if (!ACCEPTED_MIME.has(mimeType)) {
        file.resume();
        return;
      }

      fileCount++;
      const chunks = [];
      let total = 0;
      const MAX = MAX_FILE_MB * 1024 * 1024;

      file.on("data", (chunk) => {
        total += chunk.length;
        if (total > MAX) {
          // Too big—stop reading this file
          file.unpipe();
          file.resume();
          return;
        }
        chunks.push(chunk);
      });

      file.on("limit", () => {
        // Busboy emits 'limit' on size cap; discard this file
        // Dropping by not pushing to attachments
      });

      file.on("end", () => {
        if (total === 0) return; // empty / discarded
        attachments.push({
          filename: filename || "photo.jpg",
          content: Buffer.concat(chunks),
          contentType: mimeType,
        });
      });
    });

    bb.on("error", (err) => reject(err));
    bb.on("finish", () => resolve({ fields, attachments }));

    req.pipe(bb);
  });
}

/** Parse urlencoded (default HTML) or JSON bodies */
async function parseNonMultipart(req) {
  const ctype = (req.headers["content-type"] || "").toLowerCase();
  if (ctype.includes("application/json")) {
    return { fields: req.body || {}, attachments: [] };
  }
  // urlencoded
  const raw = await new Promise((resolve) => {
    let b = "";
    req.on("data", (chunk) => (b += chunk));
    req.on("end", () => resolve(b));
  });
  return { fields: parseQS(raw), attachments: [] };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  // Decide parser based on content-type
  const ctype = (req.headers["content-type"] || "").toLowerCase();
  let fields = {};
  let attachments = [];
  try {
    if (ctype.startsWith("multipart/form-data")) {
      ({ fields, attachments } = await parseMultipart(req));
    } else {
      ({ fields, attachments } = await parseNonMultipart(req));
    }
  } catch (err) {
    console.error("Body parse error:", err);
    return res.status(400).send("Bad Request");
  }

  // Honeypot (either 'website' or your current 'company')
  const hp = (fields.website || fields.company || "").toString().trim();
  if (hp !== "") {
    return res.redirect(303, "/thank-you.html");
  }

  // Determine form type
  const isDealer = fields.business !== undefined && fields.contact !== undefined;
  const isContact =
    fields.first_name !== undefined && fields.last_name !== undefined;

  let subject = "";
  let textBody = "";
  let replyToEmail = "";

  if (isDealer) {
    subject = "New Dealer Application";

    const business = sanitize(fields.business);
    const contact = sanitize(fields.contact);
    const emailRaw = sanitize(fields.email);
    const phone = sanitize(fields.phone);
    const message = sanitize(fields.message);

    if (!business || !contact || !emailRaw || !message) {
      return res.status(400).send("Please fill in all required fields.");
    }
    if (!isEmail(emailRaw)) {
      return res.status(400).send("Invalid email address.");
    }

    replyToEmail = emailRaw;
    textBody =
      `Business Name: ${business}\n` +
      `Contact Name: ${contact}\n` +
      `Email: ${emailRaw}\n` +
      `Phone: ${phone}\n\n` +
      `Shop Info:\n${message}`;
  } else if (isContact) {
    subject = "New Website Contact Submission";

    const firstName = sanitize(fields.first_name);
    const lastName = sanitize(fields.last_name);
    const emailRaw = sanitize(fields.email);
    const emailConfirm = sanitize(fields.email_confirm);
    const phone = sanitize(fields.phone);
    const city = sanitize(fields.city);
    const country = sanitize(fields.country);
    const state = sanitize(fields.state);
    const vehicleYear = sanitize(fields.vehicle_year);
    const vehicleMake = sanitize(fields.vehicle_make);
    const vehicleModel = sanitize(fields.vehicle_model);
    const comments = sanitize(fields.comments);

    if (!firstName || !lastName || !emailRaw || !emailConfirm) {
      return res.status(400).send("Please fill in all required fields.");
    }
    if (emailRaw !== emailConfirm) {
      return res.status(400).send("Emails do not match.");
    }
    if (!isEmail(emailRaw)) {
      return res.status(400).send("Invalid email address.");
    }

    replyToEmail = emailRaw;
    textBody =
      `Name: ${firstName} ${lastName}\n` +
      `Email: ${emailRaw}\n` +
      `Phone: ${phone}\n` +
      `City: ${city}\n` +
      `Country: ${country}\n` +
      `State: ${state}\n` +
      `Vehicle Year: ${vehicleYear}\n` +
      `Vehicle Make: ${vehicleMake}\n` +
      `Vehicle Model: ${vehicleModel}\n\n` +
      `Message:\n${comments}`;
  } else {
    return res.status(400).send("Invalid form submission.");
  }

  // SMTP transport
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    TO_EMAIL = "crew@machfivemotors.com",
    FROM_EMAIL = "no-reply@machfivewheels.com",
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).send("Email transport not configured.");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject,
      text: textBody,
      replyTo: isEmail(replyToEmail) ? replyToEmail : undefined,
      headers: { "X-M5-Site": "Mach Five Wheels" },
      // Busboy attachments → Nodemailer attachments
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    return res.redirect(303, "/dealer?submitted=true");
  } catch (err) {
    console.error("Email send error:", err);
    return res.status(500).send("Something went wrong. Please try again later.");
  }
}
