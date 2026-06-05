from django.urls import path
from . import views

urlpatterns = [
    path('', views.ActiveStoriesView.as_view(), name='active_stories'),
    path('create/', views.StoryCreateView.as_view(), name='create_story'),
    path('<int:pk>/view/', views.MarkStoryViewedView.as_view(), name='mark_story_viewed'),
    path('<int:pk>/', views.StoryDetailView.as_view(), name='story_detail'),
    path('<int:pk>/highlight/', views.ToggleHighlightView.as_view(), name='toggle_highlight'),
    path('user/<int:user_id>/highlights/', views.UserHighlightsView.as_view(), name='user_highlights'),
]
