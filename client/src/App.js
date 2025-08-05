import { useState, useEffect } from "react";
import CodeEditor from "./codeEditor";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [output, setOutput] = useState("");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const fixResizeObserverError = () => {
      const observerStyle = document.createElement("style");
      observerStyle.innerHTML = `
        .resize-observer {
          animation: resize-fix-animation 1ms;
        }
        @keyframes resize-fix-animation {
          from { opacity: 1; }
          to { opacity: 0.99; }
        }
      `;
      document.head.appendChild(observerStyle);
    };

    fixResizeObserverError();
  }, []);

  const generate = async () => {
    setLoading(true);
    setOutput("");
    setImage(null);

    try {
      const res = await fetch("http://localhost:5000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      setFiles(data.files || []);
      setActiveFile(data.files?.[0] || null);
    } catch (error) {
      console.error("Generation failed:", error);
      setFiles([]);
      setActiveFile({
        filename: "error.py",
        content: "# Error generating code. Please try again.",
      });
    }

    setLoading(false);
  };

  const runCode = async () => {
    setRunning(true);
    setOutput("Running...");
    setImage(null);

    try {
      const res = await fetch("http://localhost:5000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files,
          entry: "main.py", // Can be updated to user-selected entry file
        }),
      });

      const data = await res.json();
      setOutput(data.output);
      setImage(data.image);
    } catch (error) {
      console.error("Run failed:", error);
      setOutput("❌ Failed to run code.");
    }

    setRunning(false);
  };

  const updateFileContent = (filename, newContent) => {
    setFiles(files.map(f => f.filename === filename ? { ...f, content: newContent } : f));
    if (activeFile?.filename === filename) {
      setActiveFile({ ...activeFile, content: newContent });
    }
  };

  return (
    <div className="App">
      <h2>🧠 SciFusion Code Agent</h2>

      <input
        type="text"
        placeholder="Ask Gemini to generate code..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        style={{ width: "60%", padding: "10px", fontSize: "16px" }}
      />
      <p style={{ color: "#ccc", marginTop: "8px", fontSize: "14px" }}>
        Example: <code>Build an LSTM and visualize predictions. Separate files for data, model, viz, main.</code>
      </p>

      <button onClick={generate} disabled={loading}>
        {loading ? "Generating..." : "⚙️ Generate Code"}
      </button>

      <div style={{ display: "flex", width: "100%", marginTop: "20px" }}>
        <div style={{ width: "200px", background: "#1f1f1f", padding: "10px", textAlign: "left" }}>
          <h4 style={{ color: "#ccc" }}>📁 Files</h4>
          {files.map((file) => (
            <div
              key={file.filename}
              onClick={() => setActiveFile(file)}
              style={{
                padding: "6px",
                marginBottom: "4px",
                borderRadius: "4px",
                cursor: "pointer",
                backgroundColor: activeFile?.filename === file.filename ? "#3a3a3a" : "transparent",
                color: activeFile?.filename === file.filename ? "#00FFAF" : "#eee",
              }}
            >
              {file.filename}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }}>
          {activeFile && (
            <CodeEditor
              value={activeFile.content}
              onChange={(updatedContent) =>
                updateFileContent(activeFile.filename, updatedContent)
              }
            />
          )}
        </div>
      </div>

      <button onClick={runCode} disabled={running} style={{ marginTop: "20px" }}>
        {running ? "Running..." : "▶️ Run Code"}
      </button>

      <pre
        style={{
          background: "#1e1e1e",
          color: "#00FFAF",
          padding: "10px",
          marginTop: "20px",
          borderRadius: "8px",
          maxHeight: "300px",
          overflowY: "auto",
        }}
      >
        {output}
      </pre>

      {image && (
        <div>
          <h3>📊 Output Plot:</h3>
          <img
            src={`data:image/png;base64,${image}`}
            alt="Output Plot"
            style={{ maxWidth: "80%", border: "1px solid #444", borderRadius: "8px" }}
          />
        </div>
      )}
    </div>
  );
}

export default App;
