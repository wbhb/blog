module.exports = class UploadPool {
  constructor(connections) {
    this._connections = connections;
    this._uploads = [];
    this._uploadsInProgress = 0;

    this._flushing = false;
    this.done = false;

    this._uploader = this.UploaderGen(this._connections);
  }

  addUpload(upload) {
    if (!this.done) {
      this._uploads.push(upload);
      this._uploader.next();
    } else {
      throw("UploaderPool used after call to 'flush()' has finished");
    }
  }

  async flush() {
    this._flushing = true;
    return new Promise((resolve) => {
      while (!this._uploader.next().done);
      resolve();
    });
  }

  * UploaderGen(connections) {
    while (!this._flushing || this._uploads.length > 0) {
      if (this._uploadsInProgress < this._connections) {
        let upload = this._uploads.shift();
        if (upload) {
          this._uploadsInProgress++;
          upload.func.call(null, ...upload.args)
          .then(() => {
            upload.cb();
            this._uploadsInProgress--;
            if (this._flushing && this._uploadsInProgress <= 0) {
              this.done = true;
              return;
            }
          })
          .catch((err) => {
            console.warn(`Upload failed: ${err}`);
            this._uploadsInProgress--;
            if (this._flushing && this._uploadsInProgress <= 0) {
              this.done = true;
              return;
            }
          });
        } else {
          yield;
        }
      } else {
        yield;
      }
    }
  }
}