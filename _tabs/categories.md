---
layout: page
title: 카테고리
icon: fas fa-stream
order: 1
---

{% assign names = "개발|CTF/Wargame|Bug Bounty|블로그/기술문서|논문/컨퍼런스|공모전/자격증" | split: "|" %}

{% for name in names %}
  {% assign posts = site.categories[name] %}
  {% assign count = posts | size %}

  <div class="card categories">
    <div class="card-header d-flex justify-content-between hide-border-bottom">
      <span class="ms-2">
        <i class="far fa-folder fa-fw"></i>
        {% if count > 0 %}
          {% capture category_url %}/categories/{{ name | slugify | url_encode }}/{% endcapture %}
          <a href="{{ category_url | relative_url }}" class="mx-2">{{ name }}</a>
        {% else %}
          <span class="mx-2" style="color: var(--link-color, #75b5ff)">{{ name }}</span>
        {% endif %}
        <span class="text-muted small font-weight-light">{{ count }} 포스트</span>
      </span>
      <span class="category-trigger hide-border-bottom disabled" aria-hidden="true">
        <i class="fas fa-fw fa-angle-right"></i>
      </span>
    </div>
  </div>
{% endfor %}
