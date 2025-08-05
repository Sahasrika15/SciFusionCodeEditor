import Editor from "@monaco-editor/react";

function CodeEditor({ value, onChange }) {
  return (
    <div style={{ marginTop: "20px", width: "90%", marginLeft: "auto", marginRight: "auto" }}>
      <Editor
        height="400px"
        defaultLanguage="python"
        theme="vs-dark"
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export default CodeEditor;
