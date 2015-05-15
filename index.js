var childProcess = require('child_process');
var spawn = childProcess.spawn;
var exec = childProcess.exec;
var once = require('once');

module.exports = function (pid, signal, callback) {
    var tree = {};
    var pidsToProcess = {};
    tree[pid] = [];
    pidsToProcess[pid] = 1;

    switch (process.platform) {
    case 'win32':
        exec('taskkill /pid ' + pid + ' /T /F', callback);
        break;
    case 'darwin':
        buildProcessTreeDarwin(pid, tree, pidsToProcess, function () {
            killAll(tree, signal, callback);
        });
        break;
    case 'sunos':
        buildProcessTreeSunOS(pid, tree, pidsToProcess, function () {
            killAll(tree, signal, callback);
        });
        break;
    default: // Linux
        buildProcessTree(pid, tree, pidsToProcess, function () {
            killAll(tree, signal, callback);
        });
        break;
    }
};

function killAll (tree, signal, callback) {
    var killed = {};
    try {
        Object.keys(tree).forEach(function (pid) {
            tree[pid].forEach(function (pidpid) {
                if (!killed[pidpid]) {
                    killPid(pidpid, signal);
                    killed[pidpid] = 1;
                }
            });
            if (!killed[pid]) {
                killPid(pid, signal);
                killed[pid] = 1;
            }
        });
    } catch (err) {
        if (callback) {
            return callback(err);
        } else {
            throw err;
        }
    }
    if (callback) {
        return callback();
    }
}

function killPid(pid, signal) {
    try {
        process.kill(parseInt(pid, 10), signal);
    }
    catch (err) {
        if (err.code !== 'ESRCH') throw err;
    }
}

function buildProcessTree (parentPid, tree, pidsToProcess, cb) {
    var ps = spawn('ps', ['-o', 'pid', '--no-headers', '--ppid', parentPid]);
    var allData = '';
    ps.stdout.on('data', function (data) {
        var data = data.toString('ascii');
        allData += data;
    });

    var onExitClose = once(function (code) {
        delete pidsToProcess[parentPid];

        if (code != 0) {
            // no more parent processes
            if (Object.keys(pidsToProcess).length == 0) {
                cb();
            }
            return
        }

        pids = [];
        pid = '';
        for (i = 0; i < allData.length; i++) {
            if (allData[i] == '\n') {
                pids.push(parseInt(pid, 10));
                pid = '';
                continue;
            }
            if (allData[i] != ' ') {
                pid += allData[i];
            }
        }

        pids.forEach(function (pid) {
            tree[parentPid].push(pid)
            tree[pid] = [];
            pidsToProcess[pid] = 1;
            buildProcessTree(pid, tree, pidsToProcess, cb);
        });
    });

    ps.on('exit', onExitClose);
    ps.on('close', onExitClose);
}

function buildProcessTreeDarwin (parentPid, tree, pidsToProcess, cb) {
}

function buildProcessTreeSunOS (parentPid, tree, pidsToProcess, cb) {
}
