import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const TEMP_DIR = "./temp";

// Utility to run shell commands and wait
function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { cwd });

    proc.stdout.on("data", (data) => console.log(`stdout: ${data}`));
    proc.stderr.on("data", (data) => console.error(`stderr: ${data}`));

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

// Ensure temp directory exists and is clean
function resetTempDir() {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP_DIR);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post("/generate", async (req, res) => {
  const { prompt } = req.body;

  try {
    const result = await model.generateContent(`
You are an expert Python developer.

The user is requesting a complete machine learning project based on the following description:

"${prompt}"

---

### 🔧 You must generate a full, modular, and production-quality Python ML project with the following structure:

- \`main.py\`: Main training and evaluation entry point.
- \`data_loader.py\`: Loads real dataset (from standard libraries like \`tensorflow.keras.datasets\` or \`sklearn.datasets\`).
- \`model.py\`: Defines the ML or DL model.
- \`utils.py\`: Contains helpers like preprocessing, plotting, or evaluation.
- \`requirements.txt\`: Lists **all third-party installable packages** (e.g., \`tensorflow\`, \`scikit-learn\`, \`matplotlib\`, etc.).

---

### 🧠 INTELLIGENT DECISIONS TO MAKE

- **Use TensorFlow/Keras** if the user says so or if the task involves images, deep learning, or sequence modeling.
- **Use sklearn** only for basic structured/tabular tasks unless the user explicitly asks otherwise.
- If the dataset is:
  - **Standard** (e.g., MNIST, CIFAR, Fashion-MNIST, Iris, Breast Cancer), load it via \`tensorflow.keras.datasets\` or \`sklearn.datasets\`.
  - **Unknown or custom**, generate **mock data** using \`faker\`, \`numpy\`, or \`sklearn.datasets.make_*\`.

---

### ✅ MANDATORY CODE FEATURES

- All files must include their **own import statements**.
- Add comments and docstrings in every file.
- Model must be trained and evaluated using appropriate metrics.
- Classification tasks must print:
  - Accuracy, Precision, Recall, F1-Score
  - Confusion Matrix and Classification Report
- Code must be **runnable as-is**.

---

### 📦 OUTPUT FORMAT

Return the files using this format:

\`\`\`file:<filename>
<code here>
\`\`\`

Only return code files in this format. No extra commentary or explanation.

---

### 🛑 CRITICAL ERRORS TO AVOID

- Do **NOT** fallback to sklearn if the user asked for TensorFlow/Keras.
- Do **NOT** generate synthetic data if a real dataset like MNIST is requested.
- Do **NOT** ignore image formats if the dataset is image-based.

Generate a complete, high-quality, multi-file Python ML project now.
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
    res.status(500).json({
      files: [{ filename: "error.py", content: "// Error generating code\n" + err.message }],
    });
  }
});

app.post("/run", async (req, res) => {
  const { files, entry = "main.py" } = req.body;

  try {
    resetTempDir();

    for (const file of files) {
      fs.writeFileSync(path.join(TEMP_DIR, file.filename), file.content);
    }

    // Install dependencies if requirements.txt exists
    const reqPath = path.join(TEMP_DIR, "requirements.txt");
    if (fs.existsSync(reqPath)) {
      await runCommand("pip", ["install", "-r", "requirements.txt"], TEMP_DIR);
    }

    const python = spawn("python", [entry], { cwd: TEMP_DIR });

    let output = "";
    python.stdout.on("data", (data) => {
      output += data.toString();
      console.log(data.toString());
    });

    python.stderr.on("data", (data) => {
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
  } catch (err) {
    console.error("Run error:", err);
    res.status(500).json({
      output: "❌ Error running code:\n" + err.message,
    });
  }
});

app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));
