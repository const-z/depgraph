"use strict";

const fs = require("fs");
const precinct = require("precinct");
const path = require("path");
const util = require("util");

const APP_MODULE = "module";
const NODE_MODULE = "node_module";

const readFile = util.promisify(fs.readFile);

class Dependence {

	constructor({ type, name, file }) {
		if (!path.isAbsolute(file)) {
			arguments[0].file = path.resolve(file);
		}
		this.type = type;
		this.file = file;
		this.name = name;
		this.includeNodeModules = null;
	}

	async getDependencies(includeNodeModules) {
		if (!this.dependencies && this.type === APP_MODULE && this.includeNodeModules !== includeNodeModules) {
			this.includeNodeModules = includeNodeModules;
			const data = await readFile(this.file);
			let fileComponents = path.parse(this.file);
			this.dependencies = precinct(data.toString()).map(pr => {
				let type = pr.startsWith("./") || pr.startsWith("../") ? "module" : "node_module";
				let file = pr;
				if (type === APP_MODULE) {
					file = require.resolve(path.resolve(fileComponents.dir, pr));
				}
				return new Dependence({ type, name: pr, file });
			});
		}
		if (!includeNodeModules) {
			this.dependencies = this.dependencies.filter(d => d.type !== NODE_MODULE);
		}
		return this.dependencies || [];
	}

}

class AppDependencies {

	constructor({ pathMainModule, includeNodeModules }) {
		if (!path.isAbsolute(pathMainModule)) {
			pathMainModule = path.resolve(pathMainModule);
		}
		let fileComponents = path.parse(pathMainModule);
		this.startNode = {
			type: APP_MODULE,
			file: pathMainModule,
			name: fileComponents.name + fileComponents.ext
		};
		this.includeNodeModules = includeNodeModules;
	}

	async dependenciesTree() {
		if (!this.tree) {
			const antiCiclic = [];
			const process = async (dependence) => {
				if (antiCiclic.includes(dependence.file)) {
					return dependence;
				}
				antiCiclic.push(dependence.file);
				let deps = await dependence.getDependencies(this.includeNodeModules);
				for (const d of deps) {
					await process(d);
				}
				return dependence;
			};
			this.tree = await process(new Dependence(this.startNode));
		}
		return this.tree;
	}

	async dependenciesList() {
		if (!this.list) {
			await this.dependenciesTree();
			this.list = [];
			const process = (depend) => {
				if (depend.dependencies) {
					let m = { ...depend };
					delete m.dependencies;
					depend.dependencies.forEach(d => {
						let j = { ...d };
						delete j.dependencies;
						this.list.push([m, j]);
						process(d);
					});
				}
			};
			process(this.tree);
			this.list = this.list.reduce((p, c) => {
				if (!p.some(d => d[0].file === c[0].file && d[1].file === c[1].file)) {
					p.push(c);
				}
				return p;
			}, []);
		}
		return this.list;
	}

	async markdownMermaid({ nodeModulesStyle } = { nodeModulesStyle: "fill:#ccc,stroke:#333,stroke-width:2px" }) {
		if (!this.list) {
			await this.dependenciesList();
		}
		let styles = [];
		let result = this.list.map(d => {
			if (d[0].type === NODE_MODULE) {
				styles.push(`style ${d[0].file} ${nodeModulesStyle}`);
			}
			if (d[1].type === NODE_MODULE) {
				styles.push(`style ${d[1].file} ${nodeModulesStyle}`);
			}
			return `${d[0].file}[${d[0].name}] --> ${d[1].file}[${d[1].name}]`;
		});
		result.sort((a, b) => {
			return a < b ? 1 : -1;
		});
		return "```mermaid\ngraph LR\n" + result.join("\n") + "\n" + styles.join("\n") + "\n```";
	}
}

module.exports = AppDependencies;