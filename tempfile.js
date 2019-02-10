const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports.TmpFile = class TmpFile {
	constructor(name, parentPath) {
		this.path = path.join(parentPath || os.tmpdir(), 'qdtmp_' + name  + '.quickdTMP');
	}

	async write(content) {
		return new Promise(function (resolve, reject) {
			fs.appendFile(this.path, content, 'utf8', err => {
				if (err)
					reject({success: false, err});
				resolve({success: true});
			});
		}.bind(this))
	}

	writeSync(content) {
		fs.appendFileSync(this.path, content, 'utf8');
	}

	async delete() {
		return new Promise(function (resolve, reject) {
			fs.unlink(this.path, err => {
				if (err)
					reject({success: false, err});
				resolve({success: true});
			});
		});
	}

	deleteSync() {
		fs.unlinkSync(this.path);
	}

	async read() {
		return new Promise(function (resolve, reject) {
			fs.readFile(this.path, 'utf8', (content, err) => {
				if (err)
					reject({success: false, err});
				resolve({success: true, content});
			})
		});
	}
	readSync() {
		let cont;
		cont = fs.readFileSync(this.path, 'utf8');
		return cont
	}
};

module.exports.TmpDir = class TmpDir {
	constructor(name, path) {
		this.path = path.join(path || os.tmpdir(), name);

		this.children = [];
	}

	insertFileSync(name) {
		if (this.children.filter(i => i.name === name).length <= 0 || fs.existsSync(path.join(this.path, name))) {
			this.children.push(new TmpFile(name, this.path));
			return this.children[this.children.length - 1];
		} else {
			throw new Error("The file already exists");
		}
	}

	async insertDir(name) {
		if (this.children.filter(i => i.name === name).length <= 0 || fs.existsSync(path.join(this.path, name))) {
			this.children.push(new TmpDir(name, this.path));
			return this.children[this.children.length - 1];
		} else {
			throw new Error("The file already exists");
		}
	}

	insertDirSycn(name) {
		if (this.children.filter(i => i.name === name).length <= 0 || fs.existsSync(path.join(this.path, name))) {
			this.children.push(new TmpDir(name, this.path));
			return this.children[this.children.length - 1];
		} else {
			throw new Error("The file already exists");
		}
	}

	async insertFile(name) {
		if (this.children.filter(i => i.name === name).length <= 0 || fs.existsSync(path.join(this.path, name))) {
			this.children.push(new TmpFile(name, this.path));
			return this.children[this.children.length - 1];
		} else {
			throw new Error("The file already exists");
		}
	}

	deleteFileSync(name) {
		let file = this.children.filter(i => i.name === name);
		file[0].delete();
		delete file[0];
	}

	async deleteFile(name) {
		let file = this.children.filter(i => i.name === name);
		file[0].deleteMe();
		delete file[0];
	}

	deleteDirSync(name) {
		let file = this.children.filter(i => i.name === name);
		file[0].deleteMe();
		delete file[0];
	}

	async deleteDir(name) {
		let file = this.children.filter(i => i.name === name);
		file[0].delete();
		delete file[0];
	}

	async deleteMe() {
		await this.empty();
		return new Promise(function (resolve, reject){
			fs.rmdir(this.path, err => {
				if (err)
					reject(err);
				resolve({success: true});
			})
		});
	}

	async empty() {
		this.children.map(async i => {
			if (i instanceof TmpDir) {
				await this.deleteDir(i.name);
			} else if (i instanceof TmpFile) {
				await this.deleteFile(i.name);
			}
		})
	}

	emptySync() {
		this.children.map(i => {
			if (i instanceof TmpDir) {
				this.deleteDirSync(i.name);
			} else if (i instanceof TmpFile) {
				this.deleteFileSync(i.name);
			}
		})
	}

	getFiles() {
		return this.children.filter(i => i instanceof TmpFile);
	}
	getDirs() {
		return this.children.filter(i => i instanceof TmpDir);
	}
	getContent() {
		return this.children;
	}
};