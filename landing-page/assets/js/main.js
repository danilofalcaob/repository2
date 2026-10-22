(function () {
  "use strict";

  var cfg = window.SITE_CONFIG || {};
  var onlyDigits = function (value) {
    return String(value || "").replace(/\D/g, "");
  };
  var waNumber = onlyDigits(cfg.whatsapp);
  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  function waUrl(message) {
    return "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(message || cfg.whatsappMessage || "");
  }

  /* ---------- Rastreamento (GA4 / Meta Pixel / dataLayer) ---------- */

  function loadAnalytics() {
    if (cfg.ga4Id) {
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(cfg.ga4Id);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", cfg.ga4Id);
    }
    if (cfg.metaPixelId) {
      /* Snippet oficial do Meta Pixel */
      !(function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", cfg.metaPixelId);
      window.fbq("track", "PageView");
    }
  }

  function track(event, params) {
    params = params || {};
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: event }, params));
    } catch (e) {}
    if (typeof window.gtag === "function") window.gtag("event", event, params);
    if (typeof window.fbq === "function") {
      if (event === "generate_lead") window.fbq("track", "Lead", params);
      if (event === "whatsapp_click") window.fbq("track", "Contact", params);
    }
  }

  /* ---------- Origem do lead (UTM / gclid / fbclid) ---------- */

  function getAttribution() {
    var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
    var stored = {};
    try {
      stored = JSON.parse(sessionStorage.getItem("lp_attr") || "{}");
    } catch (e) {}
    var params = new URLSearchParams(window.location.search);
    var found = false;
    keys.forEach(function (k) {
      if (params.get(k)) {
        stored[k] = params.get(k);
        found = true;
      }
    });
    if (found) {
      try {
        sessionStorage.setItem("lp_attr", JSON.stringify(stored));
      } catch (e) {}
    }
    return stored;
  }

  /* ---------- Conteúdo vindo da configuração ---------- */

  function applyConfig() {
    var missing = [];
    if (!waNumber) missing.push("WhatsApp");
    if (!cfg.crm) missing.push("CRM");
    if (missing.length) {
      var banner = $("#config-banner");
      banner.textContent =
        "Configuração pendente em assets/js/config.js: " +
        missing.join(", ") +
        ". Esta faixa some quando os campos forem preenchidos.";
      banner.hidden = false;
    }

    var registro = [cfg.crm, cfg.rqe].filter(Boolean).join(" · ");
    var identificacao = [cfg.titulo, registro].filter(Boolean).join(" · ");

    $$("[data-credentials]").forEach(function (el) {
      if (identificacao) el.textContent = identificacao;
    });

    var line = $("[data-credentials-line]");
    if (line && registro) {
      line.textContent = "Dr. Danilo Falcão · " + registro;
      line.hidden = false;
    }

    var resp = $("[data-responsavel]");
    if (resp && registro) resp.textContent = "Responsável técnico: Dr. Danilo Falcão · " + registro;

    var list = $("[data-credentials-list]");
    if (list && cfg.credenciais && cfg.credenciais.length) {
      cfg.credenciais.forEach(function (item) {
        var li = document.createElement("li");
        li.innerHTML = '<svg class="icon"><use href="#i-check"/></svg>';
        li.appendChild(document.createTextNode(item));
        list.appendChild(li);
      });
      list.hidden = false;
    }

    var ig = $("[data-instagram]");
    if (ig && cfg.instagram) {
      $("a", ig).href = cfg.instagram;
      ig.hidden = false;
    }

    var mail = $("[data-email]");
    if (mail && cfg.email) {
      var a = $("a", mail);
      a.href = "mailto:" + cfg.email;
      $("span", a).textContent = cfg.email;
      mail.hidden = false;
    }

    var depo = cfg.depoimentos || [];
    if (depo.length || cfg.googleReviewsUrl) {
      var wrap = $("[data-testimonials]");
      depo.forEach(function (d) {
        var fig = document.createElement("figure");
        fig.className = "testimonial reveal";
        var quote = document.createElement("blockquote");
        quote.textContent = "“" + d.texto + "”";
        var cap = document.createElement("figcaption");
        cap.textContent = d.nome;
        fig.appendChild(quote);
        fig.appendChild(cap);
        wrap.appendChild(fig);
      });
      if (cfg.googleReviewsUrl) {
        var rl = $("[data-reviews-link]");
        $("a", rl).href = cfg.googleReviewsUrl;
        rl.hidden = false;
      }
      $("#depoimentos").hidden = false;
    }

    $$("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  /* ---------- Botões de WhatsApp ---------- */

  function wireWhatsApp() {
    $$("[data-wa]").forEach(function (el) {
      if (waNumber) {
        el.href = waUrl(el.getAttribute("data-wa-msg"));
        el.target = "_blank";
        el.rel = "noopener";
      }
      el.addEventListener("click", function () {
        track("whatsapp_click", { cta_location: el.getAttribute("data-track") || "" });
      });
    });
    $$("[data-track]:not([data-wa])").forEach(function (el) {
      el.addEventListener("click", function () {
        track("outbound_click", { cta_location: el.getAttribute("data-track") });
      });
    });
  }

  /* ---------- Foto: mostra o monograma enquanto não houver imagem ---------- */

  function wirePhotos() {
    $$("[data-photo] img").forEach(function (img) {
      var fallback = function () {
        img.closest("[data-photo]").classList.add("is-fallback");
      };
      if (img.complete && img.naturalWidth === 0) fallback();
      img.addEventListener("error", fallback);
    });
  }

  /* ---------- Cabeçalho, menu e barra fixa ---------- */

  function wireHeader() {
    var header = $(".header");
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var toggle = $(".nav-toggle");
    toggle.addEventListener("click", function () {
      var open = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    });
    $$("#nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        header.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Abrir menu");
      });
    });

    if (!("IntersectionObserver" in window)) return;
    // A barra fixa do celular aparece depois do hero e some sobre o formulário
    var heroVisible = true;
    var formVisible = false;
    var update = function () {
      document.body.classList.toggle("show-bar", !heroVisible && !formVisible);
    };
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      update();
    }).observe($(".hero__actions"));
    new IntersectionObserver(function (entries) {
      formVisible = entries[0].isIntersecting;
      update();
    }).observe($("#lead-form"));
  }

  function wireReveal() {
    var items = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---------- Formulário de lead → WhatsApp ---------- */

  function maskPhone(value) {
    var d = onlyDigits(value).slice(0, 11);
    if (d.length <= 2) return d.length ? "(" + d : "";
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }

  function wireForm() {
    var form = $("#lead-form");
    var nome = $("#f-nome");
    var tel = $("#f-tel");
    var obj = $("#f-obj");
    var msg = $("#f-msg");
    var consent = $("#f-consent");
    var status = $(".form__status", form);
    var started = false;

    tel.addEventListener("input", function () {
      tel.value = maskPhone(tel.value);
    });
    form.addEventListener("input", function () {
      if (!started) {
        started = true;
        track("form_start", {});
      }
    });

    var rules = [
      [nome, "e-nome", function () { return nome.value.trim().length >= 2; }],
      [tel, "e-tel", function () { var n = onlyDigits(tel.value).length; return n === 10 || n === 11; }],
      [obj, "e-obj", function () { return !!obj.value; }],
      [consent, "e-consent", function () { return consent.checked; }],
    ];

    function validate() {
      var firstInvalid = null;
      rules.forEach(function (r) {
        var ok = r[2]();
        r[0].setAttribute("aria-invalid", String(!ok));
        if (ok) r[0].removeAttribute("aria-describedby");
        else r[0].setAttribute("aria-describedby", r[1]);
        document.getElementById(r[1]).classList.toggle("is-shown", !ok);
        if (!ok && !firstInvalid) firstInvalid = r[0];
      });
      if (firstInvalid) firstInvalid.focus();
      return !firstInvalid;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;

      if (!waNumber) {
        status.textContent = "O número de WhatsApp ainda não foi configurado (assets/js/config.js).";
        return;
      }

      var lead = {
        nome: nome.value.trim(),
        telefone: tel.value.trim(),
        objetivo: obj.value,
        mensagem: msg.value.trim(),
        pagina: window.location.href,
        data: new Date().toISOString(),
      };
      var attr = getAttribution();
      Object.keys(attr).forEach(function (k) {
        lead[k] = attr[k];
      });

      if (cfg.leadWebhookUrl) {
        try {
          fetch(cfg.leadWebhookUrl, {
            method: "POST",
            mode: "no-cors",
            keepalive: true,
            body: new URLSearchParams(lead),
          });
        } catch (err) {}
      }

      track("generate_lead", { objetivo: lead.objetivo });

      var text = [
        "Olá! Vim pelo site e gostaria de agendar uma consulta com o Dr. Danilo Falcão.",
        "",
        "*Nome:* " + lead.nome,
        "*WhatsApp:* " + lead.telefone,
        "*Objetivo:* " + lead.objetivo,
      ];
      if (lead.mensagem) text.push("*Mensagem:* " + lead.mensagem);
      var url = waUrl(text.join("\n"));

      var win = window.open(url, "_blank");
      if (win) win.opener = null;
      else window.location.href = url;

      status.innerHTML = "";
      status.appendChild(document.createTextNode("Pronto! Abrimos o WhatsApp com a sua mensagem. Não abriu? "));
      var link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Clique aqui.";
      status.appendChild(link);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadAnalytics();
    getAttribution();
    applyConfig();
    wireWhatsApp();
    wirePhotos();
    wireHeader();
    wireReveal();
    wireForm();
  });
})();
