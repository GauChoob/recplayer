import geom from "./util/geom";

export default function objRender(levReader, recReader) {
  var appleCount = 0;

  var objs = (function() {
    var flowers = [],
      apples = [],
      killers = [],
      starts = [];

    function fl(x, y) {
      flowers.push({ type: "fl", pos: [x, y] });
    }

    function ap(x, y, grav, anim) {
      appleCount++;
      apples.push({ type: "ap", pos: [x, y], grav: grav, anim: anim });
    }

    function ki(x, y) {
      killers.push({ type: "ki", pos: [x, y] });
    }

    function st(x, y) {
      starts.push({ type: "st", pos: [x, y] });
    }

    // TODO: handle errors
    var count = levReader.objCount();
    for (var x = 0; x < count; x++) levReader.obj(x, fl, ap, ki, st);

    return [].concat(killers, apples, flowers, starts);
  })();

  var applesTaken = [];
  var gravityChanges = [];
  void (function() {
    for (var rec = 0, recR = recReader; recR; recR = recR.next, rec++) {
      var count = recR.eventCount();
      var gravC = [];
      for (var x = 0; x < count; x++)
        recR.event(x, function(time, info, type) {
          if (type == 0)
            if (
              objs.length > info &&
              objs[info].type == "ap" &&
              !("taken" in objs[info])
            ) {
              // TODO: check it's actually there?
              // TODO: maybe track gravity here?
              var frame = time / 0.01456;
              objs[info].taken = frame;
              applesTaken.push([frame, rec]);
              if (objs[info].grav > 0)
                gravC.push([
                  frame,
                  ["up", "down", "left", "right"][objs[info].grav - 1]
                ]);
            }
        });
      gravityChanges.push(gravC);
    }
    applesTaken.sort(function(a, b) {
      return (a[0] > b[0]) - (a[0] < b[0]);
    });
  })();

  return {
    appleCount: function() {
      return appleCount;
    },

    applesTaken: function(frame, rec) {
      for (var x = 0; x < applesTaken.length; x++)
        if (applesTaken[x][0] >= frame) break;
      return x;
    },

    appleTimes: function () {
      return applesTaken.map((a, i) => ({
        apple: i + 1,
        frame: a[0],
      }));
    },

    gravity: function(frame, rec) {
      var gravC = gravityChanges[rec];
      if (gravC.length == 0)
        // returns empty string if gravity is default for whole rec
        return "";
      for (var x = 0; x < gravC.length; x++) if (gravC[x][0] >= frame) break;
      return x ? gravC[x - 1][1] : "down";
    },

    draw: function (canv, lgr, frame, x, y, w, h, scale, showGravity) {
      canv.save();
      canv.scale(scale, scale);
      canv.translate(-x, -y);

      for (var z = 0; z < objs.length; z++) {
        canv.save();
        canv.translate(objs[z].pos[0], objs[z].pos[1]);
        canv.scale(40 / 48, 40 / 48);
        canv.translate(-0.5, -0.5);
        switch (objs[z].type) {
          case "ap":
            if ("taken" in objs[z] && objs[z].taken <= frame) break;
            lgr.picts[`qfood${objs[z].anim + 1}`].frame(canv, frame, objs[z].grav, showGravity);
            break;
          case "fl":
            lgr.picts.qexit.frame(canv, frame);
            break;
          case "ki":
            lgr.picts.qkiller.frame(canv, frame);
            break;
        }
        canv.restore();
      }
      canv.restore();
    }
  };
}
