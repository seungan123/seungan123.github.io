---
layout: page
title: "개발"
permalink: /topics/development/
category_name: "개발"
---

{% assign category_posts = site.categories[page.category_name] %}
{% if category_posts.size > 0 %}
  {% for post in category_posts %}
  <div class="card mb-3">
    <div class="card-body">
      <h2 class="h5 mb-2"><a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></h2>
      <small class="text-muted">{{ post.date | date: "%Y.%m.%d" }}</small>
    </div>
  </div>
  {% endfor %}
{% else %}
  <p class="text-muted">아직 게시글이 없습니다.</p>
{% endif %}
