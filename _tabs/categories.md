---
layout: page
title: 카테고리
icon: fas fa-stream
order: 1
---

{% assign pairs = "개발|development;CTF/Wargame|ctf-wargame;Bug Bounty|bug-bounty;블로그/기술문서|blog-docs;논문/컨퍼런스|papers-conferences;공모전/자격증|contests-certifications" | split: ";" %}

{% for pair in pairs %}
  {% assign item = pair | split: "|" %}
  {% assign name = item[0] %}
  {% assign slug = item[1] %}
  {% assign posts = site.categories[name] %}
  {% assign count = posts | size %}

  <div class="card categories">
    <div class="card-header d-flex justify-content-between hide-border-bottom">
      <span class="ms-2">
        <i class="far fa-folder fa-fw"></i>
        {% capture category_url %}/topics/{{ slug }}/{% endcapture %}
        <a href="{{ category_url | relative_url }}" class="mx-2">{{ name }}</a>
        <span class="text-muted small font-weight-light">{{ count }} 포스트</span>
      </span>
      <a href="{{ category_url | relative_url }}" class="category-trigger hide-border-bottom" aria-label="{{ name }} 카테고리 열기">
        <i class="fas fa-fw fa-angle-right"></i>
      </a>
    </div>
  </div>
{% endfor %}
