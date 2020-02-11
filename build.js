#!/usr/bin/env node

//  arg autoprefixer chokidar node-sass postcss rollup rollup-plugin-buble rollup-plugin-node-resolve tiny-lr

const arg = require('arg');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const chokidar = require('chokidar');
const tinylr = require('tiny-lr');

const sass = require('node-sass');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

const { rollup } = require('rollup');
const buble = require('rollup-plugin-buble');
const resolve = require('rollup-plugin-node-resolve');


const src = {
	path: path.join(__dirname, 'src')
}
const dst = {
	path: path.join(__dirname, 'dist')
}
src.css = path.join(src.path, 'style.scss');
dst.css = path.join(dst.path, 'style.css');
src.js = path.join(src.path, 'index.js');
dst.js = path.join(dst.path, 'index.js');
src.html = path.join(src.path, 'index.html');
dst.html = path.join(dst.path, 'index.html');

const args = arg({});

async function exists(path) {
	try {
		const err = await fsp.access(path);
		return !err;
	} catch (e) {
		return false;
	}
}

async function init() {
	if (!(await exists(dst.path))) {
		await fsp.mkdir(dst.path);	
	}	
}


async function transformCss() {
	function readSass(filename) {
	    return new Promise((resolve, reject) => {
	        sass.render({
	          file: filename,
	          outputStyle: 'expanded'
	        }, function(err, result) {
	            if (err) {
	                reject(err);
	            } else {
	                resolve(result);
	            }
	        });
	    });
	}

	console.log('transform css ');
	const postcssPlugins = [autoprefixer];

	if (!(await exists(src.css))) {
		console.log('no css found\n');
		return;
	}

	const result = await readSass(src.css);
	const content = await postcss(postcssPlugins).process(result.css, {from: src.css});
	await fsp.writeFile(dst.css, content);
	console.log('done\n');
}

async function transformJs() {
	console.log('transform js ');
	if (!(await exists(src.js))) {
		console.log('no js found\n');
		return;
	}

	const rollupPlugins = [resolve(), buble()];
	
	const load = await rollup({
    	input: src.js,
    	plugins: rollupPlugins
	});
	const content = await load.generate({format: 'iife'});
	await fsp.writeFile(dst.js, content.output[0].code);
	console.log('done\n');
}

async function transformHtml() {
	console.log('transform html ');
	if (!(await exists(src.html))) {
		console.log('no html found\n');
		return;
	}

	const hasJs = await exists(dst.js);
	const hasCss = await exists(dst.css);
	const hasHtml = await exists(src.html);
	
	let content = `<!DOCTYPE html>
<html><head>
	<meta charset="UTF-8">
	<title>Fumble</title>
	${hasCss ? '<link rel="stylesheet" href="./style.css">' : ''}
</head><body>
	${hasHtml ? (await fsp.readFile(src.html)) : ''}
	${hasJs ? '<script src="./index.js"></script>' : ''}  
</body></html>
`;

	await fsp.writeFile(dst.html, content);

	console.log('done\n');
}

async function run() {
	await init();
	await transformCss();	
	await transformJs();
	await transformHtml();
}

async function watch() {
	var lrserver = tinylr();
	
	chokidar.watch(src.path)
	.on('all', async (e, path) => {
		const ext = path && path.match(/[^.]+$/)[0];
		switch (ext) {
			case 'scss':
			case 'css':
				await transformCss();
				lrserver.changed({body: {files: [dst.css]}})
				break;
			case 'js':
				await transformJs();
				lrserver.changed({body: {files: [dst.js]}})
				break;
			case 'html':
				await transformHtml();
				lrserver.changed({body: {files: [dst.html]}})
				break;
		}
	});
	
	lrserver.listen();
}

if (args._[0] === 'watch') {
	watch();
} else {
	run();
}

