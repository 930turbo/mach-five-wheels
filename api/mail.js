// api/mail.js
import { Resend } from "resend";
import Busboy from "busboy";
import { parse as parseQS } from "querystring";

/* ---------- Vercel API Config ---------- */
export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "12mb",
  },
};

/* ---------- Constants ---------- */
const MAX_FILES = 8;
const MAX_FILE_MB = 10;
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/* ---------- Helpers ---------- */
const sanitize = (s = "") => String(s).replace(/[\r\n]+/g, " ").trim();
const isEmail = (e = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ---------- Multipart Parser ---------- */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: { files: MAX_FILES, fileSize: MAX_FILE_MB * 1024 * 1024 },
    });

    const fields = {};
    const attachments = [];
    let fileCount = 0;

    bb.on("field", (name, val) => (fields[name] = val));

    bb.on("file", (name, file, info) => {
      if (fileCount >= MAX_FILES) return file.resume();
      const { filename, mimeType } = info;
      if (!ACCEPTED_MIME.has(mimeType)) return file.resume();

      const chunks = [];
      let total = 0;
      file.on("data", (chunk) => {
        total += chunk.length;
        if (total > MAX_FILE_MB * 1024 * 1024) file.resume();
        else chunks.push(chunk);
      });
      file.on("end", () => {
        if (total > 0) {
          attachments.push({
            filename: filename || "photo.jpg",
            content: Buffer.concat(chunks),
            contentType: mimeType,
          });
        }
      });
      fileCount++;
    });

    bb.on("error", reject);
    bb.on("finish", () => resolve({ fields, attachments }));
    req.pipe(bb);
  });
}

/* ---------- URL-encoded / JSON Parser ---------- */
async function parseNonMultipart(req) {
  const ctype = (req.headers["content-type"] || "").toLowerCase();
  if (ctype.includes("application/json")) return { fields: req.body || {}, attachments: [] };

  let body = "";
  for await (const chunk of req) body += chunk;
  return { fields: parseQS(body), attachments: [] };
}

/* ---------- Main Handler ---------- */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  const ctype = (req.headers["content-type"] || "").toLowerCase();
  let fields = {}, attachments = [];

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

  /* ---------- Honeypot ---------- */
  const hp = (fields.website || fields.company || "").toString().trim();
  if (hp !== "") {
    // redirect back to the same page (reload)
    res.statusCode = 303;
    res.setHeader("Location", req.headers.referer || "/");
    return res.end();
  }

  /* ---------- Identify form type ---------- */
  const isDealer = fields.business && fields.contact;
  const isContact = fields.first_name && fields.last_name;

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

    if (!business || !contact || !emailRaw || !message)
      return res.status(400).send("Please fill in all required fields.");
    if (!isEmail(emailRaw)) return res.status(400).send("Invalid email address.");

    replyToEmail = emailRaw;
    textBody = `Business Name: ${business}
Contact Name: ${contact}
Email: ${emailRaw}
Phone: ${phone}

Shop Info:
${message}`;
  } else if (isContact) {
    subject = "New Website Contact Submission";
    const first = sanitize(fields.first_name);
    const last = sanitize(fields.last_name);
    const emailRaw = sanitize(fields.email);
    const confirm = sanitize(fields.email_confirm);
    const phone = sanitize(fields.phone);
    const city = sanitize(fields.city);
    const country = sanitize(fields.country);
    const state = sanitize(fields.state);
    const year = sanitize(fields.vehicle_year);
    const make = sanitize(fields.vehicle_make);
    const model = sanitize(fields.vehicle_model);
    const comments = sanitize(fields.comments);

    if (!first || !last || !emailRaw || !confirm)
      return res.status(400).send("Please fill in all required fields.");
    if (emailRaw !== confirm) return res.status(400).send("Emails do not match.");
    if (!isEmail(emailRaw)) return res.status(400).send("Invalid email address.");

    replyToEmail = emailRaw;
    textBody = `Name: ${first} ${last}
Email: ${emailRaw}
Phone: ${phone}
City: ${city}
Country: ${country}
State: ${state}
Vehicle Year: ${year}
Vehicle Make: ${make}
Vehicle Model: ${model}

Message:
${comments}`;
  } else {
    return res.status(400).send("Invalid form submission.");
  }

  /* ---------- Resend Setup ---------- */
  const resend = new Resend(process.env.RESEND_API_KEY);
  const TO_EMAIL = process.env.TO_EMAIL || "crew@machfivemotors.com";
  const FROM_EMAIL = process.env.FROM_EMAIL || "no-reply@machfivewheels.com";

  try {
    await resend.emails.send({
      from: `"${sanitize(fields.first_name || fields.business || "Website User")}" <${FROM_EMAIL}>`,
      to: [TO_EMAIL],
      subject,
      text: textBody,
      reply_to: isEmail(replyToEmail) ? replyToEmail : undefined,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
      })),
    });

    // ✅ Redirect back to same page (reload)
    res.statusCode = 303;
    res.setHeader("Location", req.headers.referer || "/");
    return res.end();
  } catch (err) {
    console.error("Resend error:", err);
    return res.status(500).send("Something went wrong. Please try again later.");
  }
}