require.config({
  waitSeconds: 120,
  paths: {
    "jquery": "/node_modules/jquery/dist/jquery.min",
    "analytics": "/node_modules/webmaker-analytics/analytics",
    "uuid": "/node_modules/node-uuid/uuid",
    "cookies": "/node_modules/cookies-js/dist/cookies",
    "moment": "/node_modules/moment/min/moment-with-locales.min",
    "fc/bramble-popupmenu": "/{{ locale }}/editor/scripts/editor/js/fc/bramble-popupmenu",
    "fc/bramble-keyhandler": "/{{ locale }}/editor/scripts/editor/js/fc/bramble-keyhandler",
    "fc/bramble-underlay": "/{{ locale }}/editor/scripts/editor/js/fc/bramble-underlay"
  },
  shim: {
    "jquery": {
      exports: "$"
    }
  }
});

require(["jquery", "constants", "analytics", "moment"], function($, Constants, analytics, moment) {
  document.querySelector("#project-list").classList.add("loaded");
  var projects = document.querySelectorAll(".bramble-user-project");
  var locale = $("html")[0].lang;
  var isLocalStorageAvailable = !!(window.localStorage);
  var favorites;
  if(isLocalStorageAvailable){
    try {
      favorites = JSON.parse(localStorage.getItem("project-favorites")) || [];
    } catch(e) {
      console.error("failed to get project favorites from localStorage with: ", e);
    }
  }
  moment.locale($("meta[name='moment-lang']").attr("content"));

  function getElapsedTime(lastEdited) {
    var timeElapsed = moment(new Date(lastEdited)).fromNow();

    return "{{ momentJSLastEdited | safe }}".replace("<% timeElapsed %>", timeElapsed);
  }

  function setFavoriteDataForProject(projectId, projectSelector, project){
    var indexOfProjectInFavorites = favorites.indexOf(projectId);
    var projectFavoriteButton = projectSelector + " .project-favorite-button";

    if(indexOfProjectInFavorites !== -1){
      favoriteProjectsElementList.push(project);
      $(projectFavoriteButton).toggleClass("project-favorite-selected");
    }

    $(projectSelector + " .project-favorite-button").on("click", function() {
      var indexOfProjectInFavorites = favorites.indexOf(projectId);
      var projectFavoriteButton = projectSelector + " .project-favorite-button";

      if(indexOfProjectInFavorites === -1) {
        favorites.push(projectId);
      } else {
        favorites.splice(indexOfProjectInFavorites, 1);
      }

      localStorage.setItem("project-favorites", JSON.stringify(favorites));
      $(projectFavoriteButton).toggleClass("project-favorite-selected");
    });
  }

  var favoriteProjectsElementList = [];

  Array.prototype.forEach.call(projects, function(project) {
    var projectSelector = "#" + project.getAttribute("id");
    var lastEdited = project.getAttribute("data-project-date_updated");
    var projectId = project.getAttribute("data-project-id");
    var publishedUrl = project.getAttribute("data-project-publish_url");
    var publishedId = publishedUrl.substring(publishedUrl.indexOf( "/", publishedUrl.indexOf("/", 7) + 1) + 1);

    if(isLocalStorageAvailable) {
      setFavoriteDataForProject(projectId, projectSelector, project);
    }

    $(projectSelector + " .remix-link").attr("href", publishedId + "/remix");
    $(projectSelector + " .project-information").text(getElapsedTime(lastEdited));
  });

  $("#project-list").prepend(favoriteProjectsElementList);

  var projectsToDelete = [];

  function deleteProject(project){
    var projectId = project.attr("data-project-id");
    var projectElementId = project.attr("id");
    $("#" + projectElementId + " > .project-title").off("click");

    analytics.event("DeleteProject");

    deleteProjectFromDB(projectId, project);
  }

  function deleteProjectFromDB(projectId, project) {
    var request = $.ajax({
      headers: {
        "X-Csrf-Token": $("meta[name='csrf-token']").attr("content")
      },
      type: "DELETE",
      url: "/" + locale + "/projects/" + projectId,
      timeout: Constants.AJAX_DEFAULT_TIMEOUT_MS
    });
    request.done(function(){
      onDeleteSuccess(project, projectId, request.status);
    });
    request.fail(function(jqXHR, status, err){
      onDeleteError(err);
    });
  }

  function onDeleteSuccess(project, projectId, status) {
    if(status !== 204) {
      console.error("[Thimble error] sending delete request for project ", projectId, status);
    }

    project.hide({
      duration: 250,
      easing: "linear",
      done: function() {
        project.remove();
      }
    });
  }

  function onDeleteError(err) {
    err = err || new Error("unknown network error");
    console.error(err);
  }

  $(".delete-button").click(function() {
    // TODO: we can do better than this, but let's at least make it harder to lose data.
    if(!window.confirm("{{ deleteProjectConfirmationText }}")) {
      return false;
    }
        
    while(projectsToDelete.length > 0) {
      deleteProject($(projectsToDelete.shift()));
    }

    $(".delete-button").toggle();
  });

  function findProject(project){
    for(var i = 0; i < projectsToDelete.length; i++){
      if(projectsToDelete[i].attr("id") === project.attr("id")) {
        return i;
      }
    }
    return -1;
  }

  $(".project-delete").click(function() {
    if($(".delete-button").css("display") === "none") {
      $(".delete-button").toggle();
    }

    var project = $(this).closest(".project");
    var projectSelector = "#" + project.attr("id");
    var deleteIndex = findProject(project);
    var disabledLink = {"cursor":"default", "text-decoration":"none"};
    var enabledLink = {"cursor":"pointer", "text-decoration":"underline"};
    
    if(deleteIndex === -1) {
      projectsToDelete.push(project);
      $(projectSelector + " .edit-link").on("click", function(link) {
        link.preventDefault();
      }).css({"cursor":"default"});

      if($(projectSelector + " .published-link").length !== 0) {
        $(projectSelector + " .published-link").on("click", function(link) {
          link.preventDefault();
        }).css(disabledLink);
        $(projectSelector + " .remix-link").on("click", function(link) {
          link.preventDefault();
        }).css(disabledLink);
      }

      project.css("background", "rgba(255,0,0,.08)");
      $(projectSelector + " .project-delete").text("Cancel");
    } else {
      projectsToDelete.splice(deleteIndex, 1);
      $(projectSelector + " .edit-link").off("click").css({"cursor":"pointer"});

      if($(projectSelector + " .published-link").length !== 0) {
        $(projectSelector + " .published-link").off("click").css(enabledLink);
        $(projectSelector + " .remix-link").off("click").css(enabledLink);
      }

      project.css("background", "");
      $(projectSelector + " .project-delete").html("<div class='icon-garbage-can'></div>");
      $(projectSelector + " .project-delete").append(document.createTextNode(" {{prjListDeleteProjectBtn}}"));


      if(projectsToDelete.length === 0) {
        $(".delete-button").toggle();
      }
    }
  });
});

function init($, uuid, cookies, PopupMenu, analytics) {
  PopupMenu.create("#navbar-logged-in .dropdown-toggle", "#navbar-logged-in .dropdown-content");
  PopupMenu.create("#navbar-locale .dropdown-toggle", "#navbar-locale .dropdown-content");
  setupNewProjectLinks($, analytics);
}

function setupNewProjectLinks($, analytics) {
  var queryString = window.location.search;
  var locale = $("html")[0].lang;

  function newProjectClickHandler(e) {
    e.preventDefault();
    e.stopPropagation();

    var cacheBust = "cacheBust=" + Date.now();
    var qs = queryString === "" ? "?" + cacheBust : queryString + "&" + cacheBust;

    $(e.target).text("{{ newProjectInProgressIndicator }}");

    analytics.event({ category : analytics.eventCategories.PROJECT_ACTIONS, action : "New Authenticated Project" });
    window.location.href = "/" + locale + "/projects/new" + qs;
  }

  $("#new-project-link").one("click", newProjectClickHandler);
  $("#project-0").one("click", newProjectClickHandler);
}

require(['jquery', 'uuid', 'cookies', 'fc/bramble-popupmenu', 'analytics'], init);
