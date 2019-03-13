import * as url_lib from 'url';
import * as TempFile from './tempfile';
import * as os from 'os';
import * as path from 'path';

const http = window.require('http');
const https = window.require('https');
const fs = window.require('fs');

class Download {
	async init(url, name, save_location, parts, onUpdate) {
		this.save_location = save_location;
		this.extension = Download.get_extension(url);
		this.final_file = path.join(save_location,name + this.extension);
		this.url = url;
		this.progress = 0;
		this.total_length = await Download.get_length(url);
		this.name = name;
		this.average_percentage = 0;
		this.average_index = 0;
		this.last_print = 0;
		this.parts = [];
		this.parts_done = 0;
		this.onUpdate = onUpdate;
		this.numOfParts = parts || 10;
		this.startTime = Date.now();

		if (url_lib.parse(url).protocol === "http:") {
			this.protocol = http;
			this.port = "80";
		} else {
			this.protocol = https;
			this.port = "443";
		}
		return this;
	}

	static get_lib(url) {
		if (url_lib.parse(url).protocol === "http:") {
			return http;
		} else {
			return https;
		}
	}

	static get_extension(url) { // https://stackoverflow.com/a/6997591/7886229
		return `.${url.split('/').pop().split('.').pop()}`;
	// 	// Remove everything to the last slash in URL
	// 	url = url.substr(1 + url.lastIndexOf("."));
	//
	// 	// Break URL at ? and take first part (file name, extension)
	// 	url = url.split('?')[0];
	//
	// 	// Sometimes URL doesn't have ? but #, so we should also do the same for #
	// 	url = url.split('#')[0];
	//
	// 	// Now we have only extension
	// 	return "."+url;
	}

	static async get_length(url) {
		return await new Promise(resolve => {
			const q = url_lib.parse(url);
			Download.get_lib(url).request({
				method: 'HEAD',
				path: q.pathname,
				host: q.hostname,
				port: (q.protocol === "http:") ? 80 : 443
			}, res => {
				resolve(Number(res.headers['content-length'] || "0"));
			}).end();
		});
	}

	static async byte_request_supported(url) {
		return await new Promise(resolve => {
			const q = url_lib.parse(url);
			Download.get_lib(url).request({
				method: 'GET',
				headers: {
					'Range': 'bytes=0-1'
				},
				path: q.pathname,
				host: q.hostname,
				port: (q.protocol === "http:") ? 80 : 443
			}, res => {
				res.on("data", (chunk) => {
					res.destroy();
					resolve(res.statusCode);
				});
			}).end();
		});
	}

	static async download_speed() {
		const url = "http://speedtest.ftp.otenet.gr/files/test1Gb.db";
		const start = Date.now();
		let dl = 0;
		let time_difference = 0;
		return await new Promise(resolve => {
			http.get(url, (resp) => {
				setTimeout(function () {
					resp.destroy();
				}, 5000);
				resp.on("data", (chunk => {
					dl += chunk.length;
				}));
				resp.on("end", function () {
					time_difference = (Date.now() - start) / 1000;
					resolve(Math.round(dl / time_difference));
				});
				resp.on('err', err => {
					console.warn(err);
				})
			});
		});
	}

	static async throttled_speed(url) {
		const start = Date.now();
		let dl = 0;
		let time_difference = 0;
		return await new Promise(resolve => {
			Download.get_lib(url).get(url, (resp) => {
				setTimeout(function () {
					resp.destroy();
				}, 5000);
				resp.on("data", (chunk => {
					dl += chunk.length;
				}));
				resp.on("end", function () {
					time_difference = (Date.now() - start) / 1000;
					resolve(Math.round(dl / time_difference));
				});
				resp.on('err', err => {
					throw err;
				})
			});
		});
	}

	average_in(percent_done_input) {
		if (this.average_index === 4) {
			this.average_index = 0;
			this.average_index = 0;
		}
		this.average_percentage = ((this.average_percentage * this.average_index) + percent_done_input) / (this.average_index + 1);
		this.average_index += 1;

		if (this.average_percentage - this.last_print > 0.01) {
			// console.log(this.average_percentage);

			this.madeProgress(0);

			this.last_print = this.average_percentage;
		}
	}

	createParts() {
		/* let num_of_parts_to_create = parseInt( Download.download_speed() / Download.throttled_speed(this.url)) - 1;
		this.totalParts = num_of_parts_to_create;
		if (num_of_parts_to_create <= 0) {
			num_of_parts_to_create = 1;
		} */
		this.num_of_parts_to_create = this.numOfParts || 10;
		let last_int = -1;
		for (let i = 0; i < this.num_of_parts_to_create; i++) {
			let to_byte = parseInt((this.total_length / this.num_of_parts_to_create) * (i + 1));
			this.parts.push(new Part(this.url, last_int + 1, to_byte, this));
			last_int = to_byte;
		}
		return this;
	}

	madeProgress(amount, done) {
		this.progress += amount;

		// console.log(this.progress, this.total_length, this.parts);
		//console.log((this.progress / this.total_length) * 100);

		const time = new Date(Date.now() - this.startTime);

		this.onUpdate({
			percentage: (this.progress / this.total_length) * 100,
			average_percentage: this.average_percentage,
			size: this.total_length,
			chunks_done: this.parts_done,
			total_chunks: this.num_of_parts_to_create,
			done: done || false,
			path: this.final_file,
			elapsedTime: `${String(time.getUTCHours()).padStart(2)}h ${String(time.getUTCMinutes()).padStart(2)}m ${String(time.getUTCSeconds()).padStart(2)}s`
		});
	}

	download_all() {
		// console.log("Downloading All Parts");
		// console.log("Num of parts: " + this.parts.length);
		return new Promise((resolve, reject) => {
			const promises = [];
			for (let i = 0; i < this.parts.length; i++) {
				promises.push(new Promise(async resolve => {
					await this.parts[i].download_bytes();
					resolve();
				}));
			}
			Promise.all(promises).then(() => resolve(this)).catch(err => reject(err));
			let that = this;
			setTimeout(function () {
				that.cancel();
				console.log("cancelled");
			},1000);
		});
	}

	imDone() {
		console.log(++this.parts_done + " of " + this.parts.length + " completed");
		this.madeProgress(0);
	}

	 combineParts_move_to_final() {
		return new Promise((resolve => {
			let final = fs.createWriteStream(this.final_file, {flags: 'a'});
			final.on('finish',resolve);
			final.on('open',async () => {
				for (const part of this.parts) {
					console.log(part.file.path);
					await new Promise((resolve,reject)=>{
						const r = fs.createReadStream(part.file.path);
						r.on('close', resolve);
						r.on('error', (err)=>{console.log(err)});
					    r.pipe(final,{end:false});
					});
				}
				final.end();
			});
		}));
	}
	cleanup(){
		for (const part of this.parts) {
			part.cleanup();
		}
	}

	cancel() {
		for (const part of this.parts) {
			part.cancel(); // complete download cancellation

		}
		this.cleanup();
	}

}

class Part {
	constructor(url, from_byte, to_byte, parent) {
		this.url = url;
		this.from_byte = parseInt(from_byte);
		this.to_byte = parseInt(to_byte);
		this.current_byte = parseInt(from_byte);
		this.stop_byte = parseInt(to_byte);
		this.file = new TempFile.TmpFile(Date.now()+from_byte);
		// console.log(this.file.path);
		this.percent_done = 0;
		this.parent = parent;
		if (url_lib.parse(url).protocol === "http:") {
			this.protocol = http;
			this.port = "80";
		} else {
			this.protocol = https;
			this.port = "443";
		}

		this.download = null
	};

	async download_bytes() {
		return await new Promise((resolve, reject) => {
			try {
				const q = url_lib.parse(this.url);
				this.download = this.protocol.get({
					port: this.port,
					protocol: q.protocol,
					path: q.pathname,
					host: q.hostname,
					headers: {
						'Range': `bytes=${this.from_byte}-${this.to_byte}`
					}
				}, res => {
					res.on('data',  res => {
						this.parent.madeProgress(Buffer.byteLength(res));
						this.file.writeSync(res);
						this.current_byte += res.length;
						this.percent_done = (this.current_byte - this.from_byte) / (this.to_byte - this.from_byte);
						this.parent.average_in(this.percent_done, this);
					});
					res.on('end', data => {
						// console.log(data);
						this.parent.imDone();
						resolve();
					});
				})
			} catch (e) {
				reject(e);
			}
		});
	}
	async cancel() {
		this.download.abort();
	}
	async cleanup() {
		this.file.deleteSync();
	}
}

export default async function beginDownload(url, name, saveLocation, parts, onUpdate) {
	const download = await new Download().init(url, name, saveLocation || (path.join(os.homedir(), 'Downloads')), parts, onUpdate);
	try {
		await download.createParts().download_all();
		await download.combineParts_move_to_final();
		await download.cleanup();
		download.madeProgress(0, true);
	} catch (e) {
		await download.cleanup();
	}
}