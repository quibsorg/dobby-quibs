// quibs.org plugins for dobby

var db = require('./db');
var async = require('async');

exports.config = function(cfg) {
    db.init(cfg.dbhost, cfg.dbuser, cfg.dbpass, cfg.dbname)
}

function auth_data(dobby, cb) {
    dobby.client_from.get_uid(function(err, uid) {
        if (!err) {
            db.query("SELECT * FROM users WHERE `teamspeak_uid`=?", [uid], function(err, results) {
                if (err) {
                    cb(err)
                } else {
                    if (results.length == 1) {
                        cb(null, results[0])
                    } else {
                        cb(null, false)
                    }
                }
            })
        } else {
            cb(err)
        }
    })
}

exports.init = function(dobby) {
    return;
    async.forever(function(next) {
        dobby.client_list(function(err, list) {
            if (!err) {
                async.map(list, function(client, cb) {
                    client.update(function() {
                        client.disable_updates();

                        async.series({
                            uid: function(cb) {client.get_uid(cb)},
                            ip: function(cb) {client.get_ip(cb)},
                            nickname: function(cb) {client.get_name(cb)},
                            cid: function(cb) {client.get_cid(cb)},
                            clid: function(cb) {client.get_clid(cb)}
                        }, function(err, results) {
                            cb(null, ["INSERT INTO teamspeak_users (ip, nickname, uid, cid, clid) VALUES (?, ?, ?, ?, ?)", [results.ip, results.nickname, results.uid, results.cid, results.clid]])
                        })
                    })
                }, function(err, list) {
                    if (!err) {
                        list.unshift(["DELETE FROM teamspeak_users", []]);
                        db.transaction(list, function(err) {
                            setTimeout(next, 5000);
                        })
                    } else {
                        setTimeout(next, 5000);
                    }
                })
            } else {
                setTimeout(next, 5000);
            }
        })
    })
}

exports.onMessage = function(msg, dobby) {
    var terms = msg.split(" ");
    var command = terms.shift();
    terms = terms.join(" ");

    switch (command) {
        case '.whoami':
            auth_data(dobby, function(err, auth) {
                if (auth) {
                    dobby.respond("You are " + auth.username + " on quibs.org. :)")
                } else {
                    dobby.respond("I don't know. Have you signed up on quibs.org and/or linked your account?")
                }
            })
        break;
        case '.q':
            var s = /^\.q add (.+)$/.exec(msg)

            if (s) {
                var newquote = s[1];

                auth_data(dobby, function(err, auth) {
                    if (auth) {
                        db.query("INSERT INTO quotes(id, text, uid) VALUES (NULL, ?, ?)", [newquote, auth.id], function(err) {
                            if (!err) {
                                dobby.respond("Quote added.")
                            } else {
                                dobby.respond("There was an error!")
                            }
                        })
                    } else {
                        dobby.respond("You're not linked with a quibs.org account!")
                    }
                })
            } else {
                var s = /^\.q ([0-9]+)$/.exec(msg)

                if (s) {
                    var quoteid = parseInt(s[1]);

                    db.query("SELECT * FROM quotes WHERE id=?", [quoteid], function(err, quotes) {
                        if (quotes.length == 1) {
                            var q = quotes[0];

                            dobby.respond("[B]Quote #" + q.id + "[/B]: " + q.text);
                        } else {
                            dobby.respond("Quote ID does not exist.");
                        }
                    })
                } else {
                    db.query("SELECT * FROM quotes", [], function(err, quotes) {
                        var q = quotes[Math.floor(Math.random() * quotes.length)];

                        dobby.respond("[B]Quote #" + q.id + "[/B]: " + q.text);
                    });
                }
            }
        break;
    }
}