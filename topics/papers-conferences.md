---
layout: page
title: "논문/컨퍼런스"
permalink: /topics/papers-conferences/
category_name: "논문/컨퍼런스"
---

{% assign category_posts = site.categories[page.category_name] %}
{% if category_posts.size > 0 %}
  <ul class="minimal-posts">
  {% for post in category_posts %}
    <li>
      <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
      <time datetime="{{ post.date | date: '%Y-%m-%d' }}">{{ post.date | date: "%Y.%m.%d" }}</time>
    </li>
  {% endfor %}
  </ul>
{% else %}
  <p class="minimal-empty">아직 게시글이 없습니다.</p>
{% endif %}
