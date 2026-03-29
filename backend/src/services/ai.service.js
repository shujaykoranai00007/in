import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateSmartCaption(mediaUrl, sourceTitle, postType = "reel") {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[AI SERVICE] ⚠️ GEMINI_API_KEY missing. Falling back to template.");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // For better results, we provide the context (source title) and the media URL.
    // If it's an image, Gemini can fetch it if given a public URL, 
    // but a safer way is to just use text-based analysis first if direct fetch fails.
    
    const prompt = `
      You are an expert Instagram Social Media Manager for an Anime niche account.
      
      Content Context: "${sourceTitle}"
      Media Type: ${postType}
      
      Task:
      1. Analyze the context of this anime content.
      2. Generate a highly engaging, viral-style Instagram caption (use emojis).
      3. Add the 15-20 "best ever" relevant hashtags.
      4. Add 5-10 SEO keywords.
      
      Format your response exactly as follows:
      CAPTION: [Your generated caption]
      HASHTAGS: [Space separated hashtags starting with #]
      KEYWORDS: [Comma separated keywords]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const captionMatch = text.match(/CAPTION:\s*([\s\S]*?)(?=\nHASTAGS:|\nHASHTAGS:|\nKEYWORDS:|$)/i);
    const hashtagsMatch = text.match(/HASHTAGS:\s*([\s\S]*?)(?=\nKEYWORDS:|$)/i);
    const keywordsMatch = text.match(/KEYWORDS:\s*([\s\S]*?)$/i);

    return {
      caption: captionMatch ? captionMatch[1].trim() : null,
      hashtags: hashtagsMatch ? hashtagsMatch[1].trim() : null,
      keywords: keywordsMatch ? keywordsMatch[1].trim() : null
    };
  } catch (error) {
    console.error("[AI SERVICE] ❌ Error generating smart caption:", error.message);
    return null;
  }
}
