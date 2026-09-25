/**
 * Guarda da landing page (landing/site): SEO básico, CTAs com os
 * marcadores que o nginx troca por ambiente e âncoras que existem.
 * A página é HTML estático, então o teste só lê o arquivo.
 */
import { describe, expect, it } from "vitest";
import html from "../../landing/site/index.html?raw";

const doc = new DOMParser().parseFromString(html, "text/html");

describe("landing page", () => {
  it("tem título, descrição e canonical para o Google", () => {
    expect(doc.title.length).toBeGreaterThan(20);
    expect(doc.title.length).toBeLessThanOrEqual(90);
    const description = doc.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(170);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("__SITE_URL__/");
    expect(doc.documentElement.lang).toBe("pt-BR");
  });

  it("tem um único h1 e imagem de compartilhamento", () => {
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute("content")).toContain("og-image.png");
  });

  it("dados estruturados (JSON-LD) são JSON válido e incluem o FAQ", () => {
    const raw = doc.querySelector('script[type="application/ld+json"]')?.textContent ?? "";
    const data = JSON.parse(raw);
    const faq = data["@graph"].find((n: { "@type": string }) => n["@type"] === "FAQPage");
    expect(faq.mainEntity.length).toBe(doc.querySelectorAll(".faq details").length);
  });

  it("todo CTA aponta para o cadastro ou para o contato, e toda âncora interna existe", () => {
    const ctas = [...doc.querySelectorAll("[data-cta]")];
    ctas.forEach((a) => expect(["__APP_URL__/signup", "__CONTACT_URL__"]).toContain(a.getAttribute("href")));
    expect(ctas.filter((a) => a.getAttribute("href") === "__APP_URL__/signup").length).toBeGreaterThanOrEqual(4);
    [...doc.querySelectorAll('a[href^="#"]')].forEach((a) => {
      const id = a.getAttribute("href")!.slice(1);
      expect(doc.getElementById(id), `âncora #${id}`).not.toBeNull();
    });
  });

  it("toda imagem tem texto alternativo", () => {
    doc.querySelectorAll("img").forEach((img) => expect(img.hasAttribute("alt")).toBe(true));
  });
});
