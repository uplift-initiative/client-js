import { NextRequest } from "next/server";
import { getClient } from "@/lib/uplift";
import OpenAI from "openai";

const VOICES: Record<string, { label: string; gender: "female" | "male" }> = {
  v_8eelc901: { label: "Info/Education", gender: "female" },
  v_meklc281: { label: "Info/Education V2", gender: "female" },
  v_30s70t3a: { label: "Nostalgic News", gender: "male" },
  v_yypgzenx: { label: "Dada Jee", gender: "male" },
};

function makeSystemPrompt(
  personaName: string,
  otherPersonaName: string,
  topic: string,
  gender: "female" | "male",
) {
  const isFemale = gender === "female";
  const selfDesc = isFemale ? "میزبانہ" : "میزبان";
  const personality = isFemale
    ? `- آپ ایک دلچسپ اور خوش مزاج خاتون ہیں
- آپ پراعتماد اور خوش اخلاق انداز میں بات کرتی ہیں
- آپ کو موضوع کی گہری سمجھ ہے
- آپ دوسروں کی بات غور سے سنتی ہیں اور ان پر تبصرہ کرتی ہیں`
    : `- آپ ایک دلچسپ اور خوش مزاج انسان ہیں
- آپ مزاحیہ انداز میں بات کر سکتے ہیں
- آپ کو موضوع کی گہری سمجھ ہے
- آپ دوسروں کی بات غور سے سنتے ہیں اور ان پر تبصرہ کرتے ہیں`;

  return `آپ "${personaName}" ہیں، ایک لائیو اردو ریڈیو شو کی ${selfDesc}۔ آپ کے ساتھی "${otherPersonaName}" ہیں۔ بات چیت "${topic}" سے شروع ہوئی ہے۔

آپ کی شخصیت:
${personality}

بات چیت کا انداز:
- ہمیشہ اردو رسم الخط میں جواب دیں
- قدرتی انداز میں بات کریں جیسے "واہ، کتنی دلچسپ بات ہے..." یا "جی بالکل..." یا "ہاں یار..." یا "اچھا سنو..."
- صرف ایک جملہ بولیں، زیادہ سے زیادہ دو جملے۔ بالکل مختصر رکھیں تاکہ بات چیت تیز اور دلچسپ رہے
- نمبر الفاظ میں لکھیں مثلاً "دو ہزار پچیس" نہ کہ "2025"
- فیصد الفاظ میں لکھیں مثلاً "ستر فیصد" نہ کہ "70%"
- انگریزی الفاظ صرف اسی وقت استعمال کریں جب بالکل ضروری ہو

بات چیت کا بہاؤ:
- بالکل حقیقی بات چیت کی طرح بات کریں، جیسے دو دوست بات کر رہے ہوں
- بات کو ایک موضوع پر نہ روکیں، بات چیت قدرتی طور پر نئی سمت لے سکتی ہے
- ذاتی تجربات، لطیفے، یادیں، یا متعلقہ کہانیاں شیئر کریں
- کبھی کبھی ساتھی سے سوال پوچھیں جو بات کو نئی سمت دے
- جیسے اصل زندگی میں ہوتا ہے، ایک بات سے دوسری بات نکل آتی ہے

اہم ہدایات:
- سادہ بات چیت کا متن لکھیں، کوئی فارمیٹنگ نہیں
- ستاروں، ہیش، بلٹ پوائنٹس، یا نمبر لسٹ استعمال نہ کریں
- اپنا نام یا لیبل جواب میں شامل نہ کریں، صرف مکالمہ لکھیں
- آپ لائیو ریڈیو پر بول رہے ہیں تو جاندار اور پرجوش انداز رکھیں`;
}

export async function POST(request: NextRequest) {
  const { topic, voice1, voice2, persona1, persona2 } = await request.json();

  if (!topic || !voice1 || !voice2) {
    return new Response("Missing topic or voice selections", { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const uplift = getClient();

  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          cancelled = true;
        }
      }

      let ws;
      try {
        ws = await uplift.tts.connect();
      } catch (err) {
        send({ type: "error", message: `Failed to connect to UpliftAI: ${err}` });
        controller.close();
        return;
      }

      const speakers = [
        { voiceId: voice1, name: persona1 || VOICES[voice1]?.label || "Speaker 1", gender: VOICES[voice1]?.gender || "male" as const },
        { voiceId: voice2, name: persona2 || VOICES[voice2]?.label || "Speaker 2", gender: VOICES[voice2]?.gender || "male" as const },
      ];

      // Two separate conversation histories — one per speaker
      const histories: { role: "user" | "assistant"; content: string }[][] = [[], []];
      let turnIndex = 0;
      let lastSpokenText = "";

      try {
        while (!cancelled) {
          const speakerIdx = turnIndex % 2;
          const currentSpeaker = speakers[speakerIdx];
          const otherSpeaker = speakers[(speakerIdx + 1) % 2];
          const history = histories[speakerIdx];

          const systemPrompt = makeSystemPrompt(currentSpeaker.name, otherSpeaker.name, topic, currentSpeaker.gender);

          let userPrompt: string;
          if (turnIndex === 0) {
            userPrompt = `شو شروع ہو رہا ہے۔ موضوع "${topic}" متعارف کروائیں اور بات چیت شروع کریں۔`;
          } else {
            userPrompt = `آپ کے ساتھی ${otherSpeaker.name} نے ابھی کہا:\n"${lastSpokenText}"\n\nقدرتی انداز میں جواب دیں اور "${topic}" پر بات جاری رکھیں۔`;
          }

          history.push({ role: "user", content: userPrompt });

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              ...history.slice(-16),
            ],
            max_tokens: 80,
            temperature: 0.8,
          });

          if (cancelled) break;

          const text = completion.choices[0]?.message?.content?.trim();
          if (!text) break;

          history.push({ role: "assistant", content: text });
          lastSpokenText = text;

          // Synthesize audio FIRST, then send turn with audio together
          const audioChunks: Buffer[] = [];
          const ttsStream = ws.stream({
            text,
            voiceId: currentSpeaker.voiceId,
            outputFormat: "MP3_22050_64",
          });

          for await (const event of ttsStream) {
            if (cancelled) {
              ttsStream.cancel();
              break;
            }
            if (event.type === "audio") {
              audioChunks.push(event.audio);
            }
          }

          if (cancelled) break;

          const fullAudio = Buffer.concat(audioChunks);
          const base64Audio = fullAudio.toString("base64");

          // Send text + audio together so the frontend only reveals the turn when it can play it
          send({
            type: "turn",
            speaker: currentSpeaker.name,
            voiceId: currentSpeaker.voiceId,
            text,
            turnIndex,
            audio: base64Audio,
          });

          turnIndex++;
        }
      } catch (err) {
        if (!cancelled) {
          send({ type: "error", message: String(err) });
        }
      } finally {
        try { ws.close(); } catch {}
        if (!cancelled) {
          try { controller.close(); } catch {}
        }
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
