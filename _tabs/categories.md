---
layout: page
title: 카테고리
icon: fas fa-stream
order: 1
---

{% assign pairs = "개발|development;CTF/Wargame|ctf-wargame;Bug Bounty|bug-bounty;블로그/기술문서|blog-docs;논문/컨퍼런스|papers-conferences;공모전/자격증|contests-certifications" | split: ";" %}

<nav class="minimal-categories" aria-label="카테고리 목록">
  {% for pair in pairs %}
    {% assign item = pair | split: "|" %}
    {% assign name = item[0] %}
    {% assign slug = item[1] %}
    {% capture category_url %}/topics/{{ slug }}/{% endcapture %}
    <a class="minimal-category" href="{{ category_url | relative_url }}">
      <span>{{ name }}</span>
      <i class="fas fa-angle-right" aria-hidden="true"></i>
    </a>
  {% endfor %}
</nav>
