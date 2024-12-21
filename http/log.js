//a Log
export class Log {
    //fp constructor
    constructor(div) {
        this.log = [];
        this.div = div;
    }

    //mp set_div
    set_div(div) {
        this.div = div;
    }

    //mp reset_log
    reset_log() {
        this.log = [];
        this.fill_div();
    }
    
    //ap is_empty
    is_empty() {
        return this.log.length==0;
    }
    
    //ap log
    log() {
        return this.log;
    }
    
    //mp add_log
    add_log(severity, src, reason, error) {
        this.log.push({ "severity":severity, "src":src, "reason":reason, "error":error});
        this.fill_div();
    }

    //mp fill_div
    fill_div() {
        if (!this.div) {
            return;
        }
        var html = "";
        for (const e of this.log) {
            const l = `${e.severity} : ${e.src} : ${e.reason} : ${e.error} : <br/>`;
            html = l + html;
        }
        this.div.innerHTML = html;
    }
    
}

