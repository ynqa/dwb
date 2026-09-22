import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

it("keeps vendor APIs inside extension and domain imports at extension entry points", () => {
	const root = fileURLToPath(new URL("./", import.meta.url));
	const violations: string[] = [];
	for (const file of readdirSync(root, { recursive: true, encoding: "utf8" })) {
		if (!/\.tsx?$/.test(file) || file.endsWith(".test.ts")) continue;
		const source = ts.createSourceFile(
			file,
			readFileSync(`${root}/${file}`, "utf8"),
			ts.ScriptTarget.Latest,
			true,
		);
		const extension = file.startsWith("extension/");
		const entry =
			file === "extension/background.ts" || file === "extension/panel.tsx";
		function visit(node: ts.Node) {
			if (!extension && ts.isIdentifier(node) && node.text === "chrome")
				violations.push(`${file}: vendor API reference`);
			if (
				ts.isImportDeclaration(node) &&
				ts.isStringLiteral(node.moduleSpecifier)
			) {
				const target = node.moduleSpecifier.text;
				if (!extension && target.includes("extension/"))
					violations.push(`${file}: imports extension implementation`);
				if (
					extension &&
					!entry &&
					/(?:@\/|\.\.\/)(deepwiki|panel|hooks|components|Dashboard|main)/.test(
						target,
					)
				)
					violations.push(`${file}: adapter imports application code`);
			}
			ts.forEachChild(node, visit);
		}
		visit(source);
	}
	expect(violations).toEqual([]);
});
