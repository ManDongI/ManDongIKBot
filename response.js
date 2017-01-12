var sessions = {};
var hookReqs = {};
var hooks = {};

function hasReq(hooking, hooked) {
    return hooked in hookReqs && hookReqs[hooked].indexOf(hooking) != -1;
}

function hasHook(hooking, hooked) {
    return hooked in hooks && hooks[hooked].indexOf(hooking) != -1;
}

function putReq(hooking, hooked) {
    if (!(hooked in hookReqs))
        hookReqs[hooked] = [];
    hookReqs[hooked].push(hooking);
}

function putHook(hooking, hooked) {
    if (!(hooked in hooks))
        hooks[hooked] = [];
    hooks[hooked].push(hooking);
}

function delReq(hooking, hooked) {
    if (hasReq(hooking, hooked))
        hookReqs[hooked].splice(hookReqs[hooked].indexOf(hooking), 1);
}

function delHook(hooking, hooked) {
    if (hasHook(hooking, hooked))
        hooks[hooked].splice(hooks[hooked].indexOf(hooking), 1);
}

function getHook(hooked) {
    if (!(hooked in hooks))
        hooks[hooked] = [];
    return hooks[hooked];
}

function evalWithProtect(room, msg, sender, isGroupChat, replier, evaluated) {
    try {
        var stopFlag = false;
        var evalThread = new java.lang.Thread(function run() {
            try {
                const ScriptableObject = org.mozilla.javascript.ScriptableObject;
                var ctx = new JavaAdapter(org.mozilla.javascript.Context, {
                    observeInstructionCount: function (i) {
                        if (stopFlag)
                            throw new java.lang.Error();
                    }
                });
                ctx.setOptimizationLevel(-1);
                var scope = ctx.initStandardObjects();
                ScriptableObject.putProperty(scope, "android", null);
                ScriptableObject.putProperty(scope, "com", null);
                ScriptableObject.putProperty(scope, "edu", null);
                ScriptableObject.putProperty(scope, "java", null);
                ScriptableObject.putProperty(scope, "javax", null);
                ScriptableObject.putProperty(scope, "net", null);
                ScriptableObject.putProperty(scope, "org", null);
                ScriptableObject.putProperty(scope, "eval", null);
                ScriptableObject.putProperty(scope, "room", room);
                ScriptableObject.putProperty(scope, "msg", msg);
                ScriptableObject.putProperty(scope, "sender", sender);
                ScriptableObject.putProperty(scope, "isGroupChat", isGroupChat);
                var _replier = {
                    reply: function (msg) {
                        replier.reply(msg);
                        replier = null;
                    }
                };
                Object.seal(_replier);
                ScriptableObject.putProperty(scope, "replier", _replier);
                ctx.evaluateString(scope, evaluated, "evalbot", 1, null);
            } catch (e) {
                replier.reply(e);
            }
        });
        evalThread.start();
        new java.lang.Thread(function run() {
            try {
                evalThread.join(5000);

                if (evalThread.isAlive()) {
                    replier.reply("실행 시간이 너무 오래 걸려 중단합니다.");
                    stopFlag = true;
                    evalThread.interrupt();
                }
            } catch (e) {
                replier.reply(e);
            }
        }).start();
    } catch (e) {
        replier.reply(e);
    }
}

function response(room, msg, sender, isGroupChat, replier) {
    sessions[room] = replier;
    const command = msg.slice(1).split(' ')[0];
    const args = msg.slice(1).split(' ').slice(1);
    getHook(room).forEach(function (e) {
        sessions[e].reply("[ " + room + " / " + sender + " ]\n" + msg);
    });

    if (command == "help") {
        replier.reply("/help - 명령 목록 출력\n\
/hook <room> - 다른 방 채팅 엿듣기\n\
/accept <room> - 채팅 엿듣기 수락\n\
/decline <room> - 채팅 엿듣기 거절\n\
/unhook <room> - 방 채팅 엿듣기 중단\n\
/eval <evalstr> - 자바스크립트 코드 평가");
    } else if (command == "hook") {
        if (args.length < 1) {
            replier.reply("잘못된 명령입니다. hook 명령은 첫째 인자를 요구합니다.");
            return;
        }

        var target = args.join(" ");

        if (!(target in sessions)) {
            replier.reply("잘못된 명령입니다. hook 명령의 첫째 인자는 유효한 방 이름이여야 합니다.");
            return;
        }

        if (hasReq(room, target) || hasHook(room, target)) {
            replier.reply("이미 요청을 보냈거나 엿듣는 중입니다.");
            return;
        }

        putReq(room, target);
        sessions[target].reply("채팅 엿듣기 요청이 " + room + " 방에서 " + sender + "에 의해 보내졌습니다.");
        replier.reply("채팅 엿듣기 요청이 성공적으로 발신 되었습니다.");
    } else if (command == "accept") {
        if (args.length < 1) {
            replier.reply("잘못된 명령입니다. accept 명령은 첫째 인자를 요구합니다.");
            return;
        }

        var target = args.join(" ");

        if (!hasReq(target, room) || hasHook(target, room)) {
            replier.reply("상응하는 요청이 없거나 이미 엿듣는 중입니다.");
            return;
        }

        delReq(target, room);
        putHook(target, room);
        replier.reply("엿듣기가 성립하였습니다.");
        sessions[target].reply(sender + "에 의해 " + room + "방의 대화를 엿듣는 중입니다.");
    } else if (command == "decline") {
        if (args.length < 1) {
            replier.reply("잘못된 명령입니다. decline 명령은 첫째 인자를 요구합니다.");
            return;
        }

        var target = args.join(" ");

        if (!hasReq(target, room) || hasHook(target, room)) {
            replier.reply("상응하는 요청이 없거나 이미 엿듣는 중입니다.");
            return;
        }

        delReq(target, room);
        replier.reply("엿듣기를 거절하였습니다.");
        sessions[target].reply(sender + "에 의해 " + room + "방의 대화를 엿듣기가 거절 당하였습니다.");
    } else if (command == "unhook") {
        if (args.length < 1) {
            replier.reply("잘못된 명령입니다. unhook 명령은 첫째 인자를 요구합니다.");
            return;
        }

        var target = args.join(" ");

        if (!hasHook(room, target)) {
            replier.reply("엿듣는 중이 아닙니다.");
            return;
        }

        delHook(room, target);
        replier.reply("엿듣기를 중단하였습니다.");
        sessions[target].reply(sender + "에 의해 " + room + "방의 대화를 엿듣기가 중단 당하였습니다.");
    } else if (command == "eval") {
        if (msg.split(/\s/).length < 2) {
            replier.reply("잘못된 명령입니다. eval 명령은 첫째 인자를 요구합니다.");
            return;
        }

        var evaluated = msg.slice("/eval".length);

        try {
            evalWithProtect(room, msg, sender, isGroupChat, replier, evaluated);
        } catch (e) {
            replier.reply(e.toString());
        }
    }
}
