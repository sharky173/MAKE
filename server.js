const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("ERROR: GEMINI_API_KEY is not set.");
}

const ai = new GoogleGenAI({
  apiKey: API_KEY
});

app.use(express.json({ limit: "15mb" }));
app.use(express.static(path.join(__dirname));

/*
  CURRENT GEMINI MODELS

  These are the models we use.
  Do NOT change these to gemini-2.5-flash or gemini-2.5-flash-lite.
*/
const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite"
];

/* =========================================================
   GENERIC JSON GENERATOR
   ========================================================= */

async function generateJSON(prompt, contentsOverride) {
  const errors = [];

  for (const model of MODELS) {
    try {
      console.log("Trying Gemini model: " + model);

      const contents = contentsOverride || prompt;

      const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: {
          responseMimeType: "application/json"
        }
      });

      if (!response || !response.text) {
        throw new Error("Gemini returned an empty response.");
      }

      console.log("Gemini model worked: " + model);

      return JSON.parse(response.text);

    } catch (error) {
      const message =
        error && error.message
          ? error.message
          : String(error);

      console.error(
        "Gemini model failed: " +
        model +
        " - " +
        message
      );

      errors.push(model + ": " + message);
    }
  }

  throw new Error(
    "All Gemini models failed.\n" +
    errors.join("\n")
  );
}

/* =========================================================
   CREATE PROJECT
   ========================================================= */

async function createProject(idea) {
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

  return generateJSON(prompt);
}

app.post("/api/create-project", async function (req, res) {
  try {
    const idea = String(
      req.body && req.body.idea
        ? req.body.idea
        : ""
    ).trim();

    if (!idea) {
      return res.status(400).json({
        error: "Please tell MAKE what you want to make."
      });
    }

    const project = await createProject(idea);

    return res.json({
      project: project
    });

  } catch (error) {
    console.error("CREATE PROJECT ERROR:", error);

    return res.status(500).json({
      error: "MAKE couldn't reach the AI.",
      detail:
        error && error.message
          ? error.message
          : String(error)
    });
  }
});

/* =========================================================
   NEXT STEP
   ========================================================= */

app.post("/api/next-step", async function (req, res) {
  try {
    const project =
      req.body && req.body.project
        ? req.body.project
        : null;

    const completedStep =
      req.body && req.body.completedStep
        ? req.body.completedStep
        : null;

    if (!project || !completedStep) {
      return res.status(400).json({
        error: "Missing project or completed step."
      });
    }

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

    const result = await generateJSON(prompt);

    return res.json(result);

  } catch (error) {
    console.error("NEXT STEP ERROR:", error);

    return res.status(500).json({
      error: "MAKE couldn't create the next step.",
      detail:
        error && error.message
          ? error.message
          : String(error)
    });
  }
});

/* =========================================================
   FASHION ADVISOR
   ========================================================= */

app.post("/api/fashion-advice", async function (req, res) {
  try {
    const event = String(
      req.body && req.body.event
        ? req.body.event
        : ""
    ).trim();

    const question = String(
      req.body && req.body.question
        ? req.body.question
        : ""
    ).trim();

    const images =
      req.body && Array.isArray(req.body.images)
        ? req.body.images
        : [];

    console.log("");
    console.log("==============================");
    console.log("FASHION REQUEST");
    console.log("==============================");
    console.log("Event: " + event);
    console.log("Outfits received: " + images.length);

    if (!event) {
      return res.status(400).json({
        error: "Tell MAKE what kind of event you're going to."
      });
    }

    if (images.length === 0) {
      return res.status(400).json({
        error: "Upload at least one outfit photo."
      });
    }

    /* -----------------------------------------
       Convert uploaded images into Gemini parts
       ----------------------------------------- */

    const imageParts = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      let imageData = "";

      if (typeof image === "string") {
        imageData = image;
      } else if (
        image &&
        typeof image.data === "string"
      ) {
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

    console.log(
      "Readable images: " +
      imageParts.length
    );

    if (imageParts.length === 0) {
      return res.status(400).json({
        error: "MAKE couldn't read those outfit photos."
      });
    }

    /* -----------------------------------------
       Fashion analysis prompt
       ----------------------------------------- */

    const prompt = [
      "You are MAKE's fashion advisor.",
      "",
      "Your job is to objectively compare the clothing shown in the uploaded images and decide which option works best for the user's event.",
      "",
      "EVENT:",
      event,
      "",
      "USER'S QUESTION:",
      question ||
        "Which outfit works best for this event?",
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
      '  "why": [',
      '    "specific reason 1",',
      '    "specific reason 2",',
      '    "specific reason 3"',
      "  ],",
      '  "tweak": "one optional improvement",',
      '  "confidence": "high|medium|low"',
      "}",
      "",
      "The reasons MUST refer to actual visible clothing details.",
      "Do not judge the user's body or attractiveness."
    ].join("\n");

    const contents = [
      {
        text: prompt
      }
    ].concat(imageParts);

    const errors = [];

    /* -----------------------------------------
       Try current models
       ----------------------------------------- */

    for (const model of MODELS) {
      try {
        console.log(
          "Trying fashion model: " +
          model
        );

        const response =
          await ai.models.generateContent({
            model: model,
            contents: contents,
            config: {
              responseMimeType: "application/json"
            }
          });

        if (!response || !response.text) {
          throw new Error(
            "Gemini returned an empty response."
          );
        }

        const advice =
          JSON.parse(response.text);

        console.log(
          "Fashion model worked: " +
          model
        );

        console.log(
          "Winner: " +
          advice.winner
        );

        return res.json(advice);

      } catch (error) {
        const message =
          error && error.message
            ? error.message
            : String(error);

        console.error(
          "Fashion model failed: " +
          model
        );

        console.error(message);

        errors.push(
          model + ": " + message
        );
      }
    }

    throw new Error(
      "All fashion models failed.\n" +
      errors.join("\n")
    );

  } catch (error) {
    console.error("");
    console.error("FASHION ERROR:");
    console.error(error);

    return res.status(500).json({
      error: "MAKE couldn't check the fits.",
      detail:
        error && error.message
          ? error.message
          : String(error)
    });
  }
});

/* =========================================================
   FRONTEND
   ========================================================= */

app.get("*", function (req, res) {
  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );
});

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(PORT, function () {
  console.log("");
  console.log("==============================");
  console.log("MAKE SERVER FILE LOADED");
  console.log(
    "MAKE running at http://localhost:" +
    PORT
  );
  console.log("==============================");
  console.log("");
});
