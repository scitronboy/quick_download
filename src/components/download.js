import React from 'react';
import Tool from './tool';
import Progress from './progress';

import * as path from "path";

import beginDownload from '../download.js';

const os = window.require('os');
const {shell} = window.require('electron');

export default class Download extends React.Component {
	constructor() {
		super(...arguments);
		this.state = {
			url: arguments[0].url,
			size: "Calculating...",
			progress: 0,
			timeStarted: Date.now(),
			chunks_done: 0,
			total_chunks: "Loading...",
			chunkSize: 1024,
			details: false,
			fileName: this.props.name,
			status: 0,
			path: "",
			id: this.props.id
		};

		console.log(this.state);

		this.startDownload();
	}

	static calculateSize(bytes) {
		let output = bytes;
		let steps = 0;

		let units = [];

		if (window.localStorage.getItem('preferredUnit') === "bin") {
			units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"];

			while (output > 1024) {
				output /= 1024;
				steps++;
			}
		} else if (window.localStorage.getItem('preferredUnit') === "dec") {
			units = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];

			while (output > 1000) {
				output /= 1000;
				steps++;
			}
		}

		return parseFloat(output).toFixed(2) + " " + units[steps];
	}

	startDownload() {
		this.download = beginDownload(this.state.url, this.state.fileName, window.localStorage.saveLocation || path.join(os.homedir(), 'Downloads'), Number(window.localStorage.partsToCreate), async info => {
			// console.log(info);
			this.setState({
				progress: info.percentage,
				size: info.size,
				friendlySize: Download.calculateSize(info.size),
				total_chunks: info.total_chunks,
				chunks_done: info.chunks_done,
				status: info.done ? 2 : 0,
				path: info.path,
				elapsedTime: info.elapsedTime
			});

			if (this.state.status === 2 && window.localStorage.getItem('allowNotifications') === "true") {
				new Notification('Download Complete', {body: `Download of ${this.state.fileName} has been completed`, icon: "./favicon.ico"}).onclick = () => window.require('electron').remote.getCurrentWindow().focus();
			}

			this.props.updateTaskBarProgress(this.state.id, this.state.progress);

			this.cancelDownload = info.cancel;

		}).catch(e => {
			console.error(e);
			this.setState({
				status: 1
			})
		});
	}

	toggleDetails() {
		this.setState(prevState => ({details: !prevState.details}));
	}

	open() {
		shell.showItemInFolder(this.state.path);
	}

	render() {
		return (
			<div className={"download" + (this.state.status === 1 ? " failed" : this.state.status === 2 ? " done" : "")}>
				<div className="header">
					<h2>{this.state.fileName}</h2>
					<div className="tools">
						{this.state.status === 2 ?
							<Tool className="open-in-folder" onClick={e => this.open()} icon={"fas fa-folder"} /> : null}
						{this.state.status === 1 ?
							<Tool className="retry" onClick={e => this.startDownload()} icon={"fas fa-redo-alt"} /> : null}
						<Tool className="show-download-details" onClick={e => this.toggleDetails()} icon={!this.state.details ? "fas fa-chevron-left" : "fas fa-chevron-down"} />
						<Tool className="download-cancel-btn" onClick={e => {
							try {
								this.cancelDownload(this);
							} catch (e) {
								delete this.download;
							}
						}} icon={"fas fa-times"} />
					</div>
				</div>
				{this.state.details ?
					<div className="download-details">
						<span className="download-detail"><b>Elapsed Time: </b>{this.state.elapsedTime}</span>
						<span className="download-detail"><b>Final File Destination: </b>{this.state.path}</span>
						<span className="download-detail"><b>Source: </b>{this.state.url}</span>
						<span className="download-detail"><b>Size: </b>{this.state.friendlySize} ({this.state.size} bytes)</span>
						<span
							className="download-detail"><b>Estimated Time of completion: </b>{/*Calculate completion time*/}Today</span>
						<span
							className="download-detail"><b>Parts downloaded: </b>{this.state.chunks_done} of {this.state.total_chunks}</span>
						<span className="download-detail"><b>Progress: </b>{this.state.progress}%</span>
					</div>
					: undefined
				}

				{this.state.status === 0 ? <Progress className={this.state.status === 1 ? "failed" : this.state.status === 2 ? "done" : ""} value={this.state.progress} /> : null}
			</div>
		);
	}
}