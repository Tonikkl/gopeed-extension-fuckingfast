(function () {
  var DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

  function text(value) {
    return value === undefined || value === null ? "" : String(value);
  }

  function setting(name, fallback) {
    var value = gopeed.settings && gopeed.settings[name];
    value = text(value);
    return value || fallback || "";
  }

  function info() {
    if (gopeed.logger && gopeed.logger.info) {
      gopeed.logger.info.apply(gopeed.logger, arguments);
    }
  }

  function error() {
    if (gopeed.logger && gopeed.logger.error) {
      gopeed.logger.error.apply(gopeed.logger, arguments);
    }
  }

  function decodeEntities(value) {
    var named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: "\"" };
    return text(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (full, entity) {
      if (entity.charAt(0) === "#") {
        var hex = entity.charAt(1).toLowerCase() === "x";
        var code = parseInt(hex ? entity.slice(2) : entity.slice(1), hex ? 16 : 10);
        return isNaN(code) ? full : String.fromCharCode(code);
      }
      return named[entity] || full;
    });
  }

  function stripTags(value) {
    return decodeEntities(text(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());
  }

  function jsString(value) {
    return decodeEntities(text(value)
      .replace(/\\\//g, "/")
      .replace(/\\u([0-9a-fA-F]{4})/g, function (_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      })
      .replace(/\\x([0-9a-fA-F]{2})/g, function (_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      })
      .replace(/\\(["'\\])/g, "$1"));
  }

  function requestUrl(ctx) {
    var rawUrl = text(ctx.req && ctx.req.rawUrl);
    var url = rawUrl || text(ctx.req && ctx.req.url);
    return url.split("#")[0];
  }

  function fragmentName(ctx) {
    var rawUrl = text(ctx.req && ctx.req.rawUrl) || text(ctx.req && ctx.req.url);
    var hashIndex = rawUrl.indexOf("#");
    if (hashIndex < 0) {
      return "";
    }
    try {
      return decodeURIComponent(rawUrl.slice(hashIndex + 1));
    } catch (_) {
      return rawUrl.slice(hashIndex + 1);
    }
  }

  function attr(tag, name) {
    var pattern = new RegExp(name + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i");
    var match = pattern.exec(tag);
    return match ? decodeEntities(match[2]).trim() : "";
  }

  function meta(html, name) {
    var tags = html.match(/<meta\b[^>]*>/gi) || [];
    for (var i = 0; i < tags.length; i++) {
      if (attr(tags[i], "name").toLowerCase() === name.toLowerCase()) {
        return attr(tags[i], "content");
      }
    }
    return "";
  }

  function first(pattern, value) {
    var match = pattern.exec(value);
    return match ? match[1] : "";
  }

  function directUrl(html) {
    var patterns = [
      /window\.open\(\s*["']([^"']*dl\.fuckingfast\.co\/dl\/[^"']+)["']/i,
      /window\.location(?:\.href)?\s*=\s*["']([^"']*dl\.fuckingfast\.co\/dl\/[^"']+)["']/i,
      /href\s*=\s*["']([^"']*dl\.fuckingfast\.co\/dl\/[^"']+)["']/i,
      /["']([^"']*dl\.fuckingfast\.co\/dl\/[^"']+)["']/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var found = first(patterns[i], html);
      if (found) {
        found = jsString(found).trim();
        return found.indexOf("//") === 0 ? "https:" + found : found;
      }
    }
    return "";
  }

  function urlName(url) {
    var part = text(url).split("#")[0].split("?")[0].split("/").pop();
    if (!part) {
      return "";
    }
    try {
      return decodeURIComponent(part);
    } catch (_) {
      return part;
    }
  }

  function pageName(html, ctx, pageUrl, resolvedUrl) {
    return fragmentName(ctx) ||
      meta(html, "title") ||
      stripTags(first(/<title[^>]*>([\s\S]*?)<\/title>/i, html)) ||
      stripTags(first(/<span[^>]*class=["'][^"']*\btext-xl\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, html)) ||
      urlName(resolvedUrl) ||
      urlName(pageUrl) ||
      "fuckingfast-download";
  }

  function fileSize(html) {
    var value = stripTags(first(/Size:\s*([^|<]+)/i, html));
    var match = /([0-9]+(?:\.[0-9]+)?)\s*([kmgtp]?i?b)/i.exec(value);
    if (!match) {
      return 0;
    }
    var powers = { b: 0, kb: 1, kib: 1, mb: 2, mib: 2, gb: 3, gib: 3, tb: 4, tib: 4, pb: 5, pib: 5 };
    var power = powers[match[2].toLowerCase()];
    return typeof power === "number" ? Math.round(parseFloat(match[1]) * Math.pow(1024, power)) : 0;
  }

  function pageHeaders(pageUrl) {
    var headers = {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Referer": "https://fuckingfast.co/",
      "User-Agent": setting("userAgent", DEFAULT_UA)
    };
    var cookie = setting("cookie", "");
    if (cookie) {
      headers.Cookie = cookie;
    }
    return headers;
  }

  function downloadHeaders(pageUrl) {
    return {
      "Accept": "*/*",
      "Referer": pageUrl,
      "User-Agent": setting("userAgent", DEFAULT_UA)
    };
  }

  async function resolvePage(ctx, source) {
    var pageUrl = requestUrl(ctx);
    info("fuckingfast " + source + " entered", text(ctx.req && ctx.req.rawUrl), text(ctx.req && ctx.req.url), pageUrl);

    var response = await fetch(pageUrl, { headers: pageHeaders(pageUrl) });
    var html = await response.text();
    info("fuckingfast page fetched", pageUrl, String(html.length));

    var resolvedUrl = directUrl(html);
    if (!resolvedUrl) {
      error("fuckingfast direct URL not found", pageUrl, String(html.length));
      throw new Error("FuckingFast direct download URL not found");
    }

    var name = pageName(html, ctx, pageUrl, resolvedUrl);
    var size = fileSize(html);
    info("fuckingfast resolved", name, resolvedUrl, String(size));
    return {
      pageUrl: pageUrl,
      resolvedUrl: resolvedUrl,
      name: name,
      size: size
    };
  }

  function resolvedFile(resolved) {
    var file = {
      name: resolved.name,
      req: {
        url: resolved.resolvedUrl,
        extra: {
          header: downloadHeaders(resolved.pageUrl)
        }
      },
      connections: 1,
      tolerance: 0
    };
    if (resolved.size > 0) {
      file.size = resolved.size;
    }
    return file;
  }

  gopeed.events.onResolve(async function (ctx) {
    var resolved = await resolvePage(ctx, "resolver");
    var file = resolvedFile(resolved);

    ctx.res = {
      name: resolved.name,
      files: [file]
    };
  });

  gopeed.events.onStart(async function (ctx) {
    var task = ctx.task || {};
    var meta = task.meta || {};
    var req = meta.req || {};
    if (!req.url && !req.rawUrl) {
      return;
    }

    var originalUrl = text(req.rawUrl) || text(req.url);
    var resolved = await resolvePage({ req: req }, "starter");
    req.rawUrl = originalUrl;
    req.url = resolved.resolvedUrl;
    req.extra = req.extra || {};
    req.extra.header = downloadHeaders(resolved.pageUrl);

    info("fuckingfast start rewrite", originalUrl, "->", req.url);
  });
})();
