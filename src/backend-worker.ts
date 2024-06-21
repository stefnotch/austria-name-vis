import { loadPyodide } from "pyodide";
import backendCode from "./backend-code.py?raw";

const pyodidePromise = loadPyodide({
  indexURL: import.meta.env.BASE_URL + "pyodide/",
  packages: ["pandas"],
}).then(async (pyodide) => {
  let dataString = await fetch(
    import.meta.env.BASE_URL + "OGDEXT_VORNAMEN_1.csv"
  ).then((v) => v.text());
  pyodide.FS.writeFile("/data.csv", dataString);
  pyodide.runPython(backendCode);
  return pyodide;
});

export type WorkerMessage = {
  id: number;
  fn: string;
  args: any[];
};
export type WorkerResponse = {
  id: number;
  result: any;
};

globalThis.addEventListener(
  "message",
  async (event: MessageEvent<WorkerMessage>) => {
    try {
      let pyodide = await pyodidePromise;
      let { id, fn, args } = event.data;

      console.log("Worker received message", { id, fn, args });
      const func = pyodide.globals.get("call_fn");
      let result = func.call(null, fn, JSON.stringify(args));
      globalThis.postMessage({
        id,
        result: JSON.parse(result),
      } as WorkerResponse);
    } catch (error) {
      setTimeout(() => {
        throw error;
      });
    }
  }
);
