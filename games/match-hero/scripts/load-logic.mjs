import ts from "typescript";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
const dir = mkdtempSync(tmpdir() + "/match-hero-");
for (const name of ["config", "logic"])
  writeFileSync(
    `${dir}/${name}.mjs`,
    ts
      .transpileModule(readFileSync(`src/game/${name}.ts`, "utf8"), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      })
      .outputText.replace(/(['"])\.\/config\1/g, "'./config.mjs'"),
  );
export const logic = await import(`${dir}/logic.mjs`);
export const { CONFIG, RELICS } = await import(`${dir}/config.mjs`);
