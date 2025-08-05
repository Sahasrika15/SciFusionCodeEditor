import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { exec,spawn} from "child_process";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const TEMP_DIR = "./temp";
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post("/generate", async (req, res) => {
  const { prompt } = req.body;

try {
  const result = await model.generateContent(`
You are a Python expert. Create a complete, well-structured, multi-file Python project based on the following user request:

"\${prompt}"

Guidelines:
1. If the user-specified dataset is available via standard Python libraries like \`sklearn.datasets\`, load it using those built-ins (e.g., Iris, Digits, Breast Cancer datasets).
2. If the dataset is **not available** via standard libraries, generate **synthetic or mock data** using libraries like \`faker\`, \`numpy\`, or \`random\`.
3. The project must be **self-contained and runnable independently** — no reliance on external files or non-standard datasets unless fetched from standard Python libraries.
4. Organize the code into multiple Python files (such as \`main.py\`, \`data_loader.py\`, \`model.py\`, \`utils.py\`, etc.) following Python best practices for modularity and readability.
5. Each file must include **all necessary import statements** explicitly within that file. Do not assume shared or global imports.
6. After training the model, print all relevant evaluation metrics: **accuracy**, **precision**, **recall**, **F1-score**, **confusion matrix**, and **classification report**.
7. At the end, include a properly formatted \`requirements.txt\` file that lists **every installable third-party Python module** used in the project (e.g., \`scikit-learn\`, \`pandas\`, \`matplotlib\`, \`faker\`, etc.).

Return the entire project in the following format:

\`\`\`file:<filename>
<code>
\`\`\`

IMPORTANT:
- Ensure the code is complete, modular, correctly formatted, and ready to run.
- Every Python file must contain its own import statements.
`);

    const response = await result.response.text();
    const fileMatches = [...response.matchAll(/```file:(.+?)\n([\s\S]*?)```/g)];
    const files = fileMatches.map(([, filename, content]) => ({
      filename: filename.trim(),
      content: content.trim(),
    }));

    res.json({ files });
  } catch (err) {
    console.error("Generation error:", err);
    res.status(500).json({ files: [{ filename: "error.py", content: "// Error generating code" }] });
  }
});

app.post("/run", (req, res) => {
  const { files, entry } = req.body;
  const entryFile = entry || "main.py";

  for (const file of files) {
    fs.writeFileSync(path.join(TEMP_DIR, file.filename), file.content);
  }

  // If requirements.txt exists, install dependencies first
  const reqPath = path.join(TEMP_DIR, "requirements.txt");
  if (fs.existsSync(reqPath)) {
    const install = spawn("pip", ["install", "-r", "requirements.txt"], { cwd: TEMP_DIR });
    install.stdout.on("data", data => console.log(`Install: ${data}`));
    install.stderr.on("data", data => console.error(`Install error: ${data}`));
  }

  const python = spawn("python", [entryFile], { cwd: TEMP_DIR });

  let output = "";
  python.stdout.on("data", data => {
    output += data.toString();
    // You could stream this directly to frontend via WebSocket or SSE
    console.log(data.toString());
  });

  python.stderr.on("data", data => {
    output += `\n❌ ${data.toString()}`;
  });

  python.on("close", () => {
    const plotPath = path.join(TEMP_DIR, "plot.png");
    let image = null;

    if (fs.existsSync(plotPath)) {
      const imgBuffer = fs.readFileSync(plotPath);
      image = imgBuffer.toString("base64");
    }

    res.json({ output, image });
  });
});


app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));
