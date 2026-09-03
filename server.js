const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite"
];

/* =========================================================
   GEMINI
   ========================================================= */

async function generateJSON(apiKey, prompt, contentsOverride = null) {
  const errors = [];

  for (const model of MODELS) {
    try {
      const contents = contentsOverride || [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ];

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message || `HTTP ${response.status}`
        );
      }

      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("Gemini returned an empty response.");
      }

      return JSON.parse(text);

    } catch (error) {
      errors.push(
        `${model}: ${error?.message || String(error)}`
      );
    }
  }

  throw new Error(errors.join("\n"));
}


/* =========================================================
   CREATE PROJECT
   ========================================================= */

async function createProject(apiKey, idea) {
  const prompt = [
    "You are MAKE, a patient project teacher for complete beginners.",
    "",
    "The user's idea is:",
    idea,
    "",
    "Create a personalised project.",
    "",
    "Return ONLY valid JSON.",
    "",
    "{",
    '  "title": "short project title",',
    '  "category": "painting|fashion|spaces|food|photography|diy|websites|other",',
    '  "theme": "short theme",',
    '  "questions": [],',
    '  "firstStep": {',
    '    "title": "short step title",',
    '    "instruction": "one small action",',
    '    "check": "how the user knows they completed it"',
    "  }",
    "}",
    "",
    "Rules:",
    "- Ask only questions that actually matter.",
    "- Give ONE small first step.",
    "- Do not dump a huge tutorial.",
    "- Assume the user has never done this particular project before.",
    "- Be friendly and clear.",
    "- The goal is to actually help them finish the project."
  ].join("\n");

  return generateJSON(apiKey, prompt);
}


/* =========================================================
   NEXT STEP
   ========================================================= */

async function nextStep(apiKey, project, completedStep) {
  const prompt = [
    "You are MAKE, a patient teacher helping a complete beginner finish a project.",
    "",
    "PROJECT:",
    JSON.stringify(project),
    "",
    "THE USER JUST COMPLETED:",
    JSON.stringify(completedStep),
    "",
    "Decide whether the project is genuinely complete.",
    "",
    "IMPORTANT:",
    "- Do NOT invent unnecessary extra tasks.",
    "- Do NOT create pointless tiny steps.",
    "- Do NOT make the user continue just for the sake of continuing.",
    "- Only give another step if it is actually necessary.",
    "- If the user can reasonably say 'I made it', mark the project complete.",
    "",
    "Return ONLY valid JSON.",
    "",
    "If complete:",
    "{",
    '  "complete": true,',
    '  "message": "short friendly completion message"',
    "}",
    "",
    "If NOT complete:",
    "{",
    '  "complete": false,',
    '  "title": "short meaningful step title",',
    '  "instruction": "one clear meaningful action",',
    '  "check": "how the user knows this step is complete"',
    "}",
    "",
    "Rules:",
    "- Give exactly ONE meaningful next step.",
    "- Never repeat the completed step.",
    "- Keep it beginner-friendly."
  ].join("\n");

  return generateJSON(apiKey, prompt);
}


/* =========================================================
   FASHION ADVISOR
   ========================================================= */

async function fashionAdvice(apiKey, event, question, images) {
  const imageParts = [];

  for (const image of images) {
    let imageData = "";

    if (typeof image === "string") {
      imageData = image;
    } else if (image && typeof image.data === "string") {
      imageData = image.data;
    }

    const matches = imageData.match(
      /^data:(image\/[^;]+);base64,(.+)$/
    );

    if (matches) {
      imageParts.push({
        inlineData: {
          mimeType: matches[1],
          data: matches[2]
        }
      });
    }
  }

  if (imageParts.length === 0) {
    throw new Error("MAKE couldn't read those outfit photos.");
  }

  const prompt = [
    "You are MAKE's fashion advisor.",
    "",
    "Your job is to objectively compare the clothing shown in the uploaded images and decide which option works best for the user's event.",
    "",
    "EVENT:",
    event,
    "",
    "USER'S QUESTION:",
    question || "Which outfit works best for this event?",
    "",
    "IMPORTANT IMAGE ANALYSIS RULES:",
    "- Carefully inspect every uploaded image.",
    "- Identify each visible outfit or clothing option separately.",
    "- Only discuss clothing and details that are actually visible.",
    "- Do not invent brands, colours, accessories or clothing.",
    "- If an image shows a complete outfit, judge the complete outfit.",
    "- If an image shows separate clothing items, judge how they could work together.",
    "",
    "JUDGING CRITERIA:",
    "1. Suitability for the event.",
    "2. Formality level.",
    "3. Colour coordination.",
    "4. Overall outfit coordination.",
    "5. Proportions and silhouette.",
    "6. Whether the pieces work together.",
    "7. Overall style and vibe.",
    "",
    "MOST IMPORTANT:",
    "Do not simply choose the first outfit.",
    "Actually compare all visible options.",
    "If one option is clearly stronger, clearly name it.",
    "If the difference is small, say that honestly.",
    "",
    "Use natural Gen Z language, but keep it useful and not cringe.",
    "",
    "Return ONLY valid JSON in exactly this format:",
    "{",
    '  "winner": "the best outfit or option",',
    '  "verdict": "short overall verdict",',
    '  "advice": "clear explanation of the decision",',
    '  "why": ["specific reason 1", "specific reason 2", "specific reason 3"],',
    '  "tweak": "one optional improvement",',
    '  "confidence": "high|medium|low"',
    "}",
    "",
    "The reasons MUST refer to actual visible clothing details.",
    "Do not judge the user's body or attractiveness."
  ].join("\n");

  const contents = [
    {
      role: "user",
      parts: [
        { text: prompt },
        ...imageParts
      ]
    }
  ];

  return generateJSON(apiKey, null, contents);
}


/* =========================================================
   API ROUTER
   ========================================================= */

async function handleAPI(request, env) {
  if (!env.GEMINI_API_KEY) {
    return Response.json(
      {
        error: "GEMINI_API_KEY is not configured."
      },
      { status: 500 }
    );
  }

  const url = new URL(request.url);

  let body = {};

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON request." },
      { status: 400 }
    );
  }

  try {

    /* CREATE PROJECT */

    if (
      request.method === "POST" &&
      url.pathname === "/api/create-project"
    ) {
      const idea = String(body.idea || "").trim();

      if (!idea) {
        return Response.json(
          {
            error: "Please tell MAKE what you want to make."
          },
          { status: 400 }
        );
      }

      const project = await createProject(
        env.GEMINI_API_KEY,
        idea
      );

      return Response.json({ project });
    }


    /* NEXT STEP */

    if (
      request.method === "POST" &&
      url.pathname === "/api/next-step"
    ) {
      if (!body.project || !body.completedStep) {
        return Response.json(
          {
            error: "Missing project or completed step."
          },
          { status: 400 }
        );
      }

      const result = await nextStep(
        env.GEMINI_API_KEY,
        body.project,
        body.completedStep
      );

      return Response.json(result);
    }


    /* FASHION */

    if (
      request.method === "POST" &&
      url.pathname === "/api/fashion-advice"
    ) {
      const event = String(body.event || "").trim();
      const question = String(body.question || "").trim();

      const images = Array.isArray(body.images)
        ? body.images
        : [];

      if (!event) {
        return Response.json(
          {
            error:
              "Tell MAKE what kind of event you're going to."
          },
          { status: 400 }
        );
      }

      if (images.length === 0) {
        return Response.json(
          {
            error:
              "Upload at least one outfit photo."
          },
          { status: 400 }
        );
      }

      const result = await fashionAdvice(
        env.GEMINI_API_KEY,
        event,
        question,
        images
      );

      return Response.json(result);
    }


    return Response.json(
      { error: "API route not found." },
      { status: 404 }
    );

  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "MAKE couldn't reach the AI.",
        detail: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}


/* =========================================================
   CLOUDFLARE WORKER
   ========================================================= */

export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    /* API requests go to Gemini backend */

    if (url.pathname.startsWith("/api/")) {
      return handleAPI(request, env);
    }

    /* Everything else comes from public/ */

    return env.ASSETS.fetch(request);
  }
};
