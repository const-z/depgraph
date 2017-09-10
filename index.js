"use strict";

const fs = require("fs");
const path = require("path");
const util = require("util");

const AppDependencies = require("./app-dependencies");

const writeFile = util.promisify(fs.writeFile);

const baseDir = "<base dir>";

const run = async () => {
	const appDependencies = new AppDependencies({
		pathMainModule: path.join(baseDir, "index.js"),
		includeNodeModules: false
	});
	let mermaid = await appDependencies.markdownMermaid();
	await writeFile("./.etc/graph.md", mermaid);
	console.log("...done");
};

run();