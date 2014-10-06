'use strict';
/**
 * Based on Fabio Lombardi's original work
 * Edited by Philippe Ozil
 */

(function() {

var appModule = angular.module('dashboardModule', ['ui.bootstrap', 'ngBonita']);

appModule.config(function (bonitaConfigProvider) {
    bonitaConfigProvider.setBonitaUrl('/bonita');
});

// Constant used to specify resource base path (facilitates integration into a Bonita custom page)
appModule.constant('RESOURCE_PATH', 'pageResource?page=custompage_angulardashboard&location=');

appModule.controller('DashboardController', 
	['$scope', '$modal', 'RESOURCE_PATH', 'bonitaConfig', 'BonitaSession', 'User', 'ArchivedHumanTask', 'ArchivedProcessInstance', 
	function ($scope, $modal, RESOURCE_PATH, bonitaConfig, BonitaSession, User, ArchivedHumanTask, ArchivedProcessInstance) {
	
		// Prepare scope
        $scope.showRest = [];
        $scope.totalTasksToDo = null;
        $scope.totalArchivedTasksToDo = null;
        $scope.totalAppsAvailable = null;
        $scope.totalCasesOpen = null;
        $scope.totalArchivedCase = null;
        $scope.user = null;

		// Load data using ngBonita resources
        BonitaSession.getCurrent().$promise.then(function(session){
			// Save session info
			bonitaConfig.setUsername(session.user_name);
			bonitaConfig.setUserId(session.user_id);
            
			// Broadcast refresh signal to all dashboard panes
			$scope.$broadcast('refresh_list');
			
			// Load user data
			User.get({
                id:session.user_id
            }).$promise.then(function(user) {
                $scope.user = user;
            });
			// Load archived tasks for stats
            ArchivedHumanTask.getCompletedByCurrentUser({
                p:0,
                c:1,
				d:'rootContainerId'
            }).$promise.then(function(archivedTasks) {
                    $scope.archivedTasks = archivedTasks.items;
                    $scope.totalArchivedTasks = archivedTasks.totalCount;
            });
			// Load archived cases for stats
            ArchivedProcessInstance.getStartedByCurrentUser({
                p:0,
                c:1,
                d:'processDefinitionId'
            }).$promise.then(function(archivedCases) {
                    $scope.archivedCases = archivedCases.items;
                    $scope.totalArchivedCases = archivedCases.totalCount;
            });
        });

		$scope.getAvatarUrl = function() {
			if ($scope.user)
				return 'attachmentImage?src=' + $scope.user.icon;
			else
				return 'attachmentImage?src=/default/icon_user.png';
		};
		
        $scope.hover = function(element) {
            return $scope.showRest[element] = ! $scope.showRest[element];
        };

        $scope.getDate = function(date) {
            return new Date(date).toLocaleString();
        }

		// Modal dialog that displays REST documentation
        $scope.openRestModal = function(url) {
            var modalInstance = $modal.open({
                templateUrl: RESOURCE_PATH +'directives/modal/' + url,
                controller: ['$scope', '$modalInstance', function ($scope, $modalInstance) {

                    $scope.ok = function () {
                        $modalInstance.close();
                    };

                }]
            });
        };

		// Modal dialog that displays an iframe
        $scope.openStartModal = function (id, processName, processVersion, operationType, taskName) {
            var dialog = $modal.open({
                templateUrl: RESOURCE_PATH +'directives/modal/start-process.html',
                controller:  ['$scope', '$modalInstance', '$sce', 'bonitaConfig', function ($scope, $modalInstance, $sce, bonitaConfig) {
                    $scope.cancel = function () {
                        $modalInstance.dismiss('cancel');
                    };
                    $scope.getUrl = function () {
                        var url = null;
                        if (operationType == "startApp") {
                            url = $sce.trustAsResourceUrl(bonitaConfig.getBonitaUrl() + '/portal/homepage?ui=form&locale=en&tenant=1#form=' + processName + '--' + processVersion + '$entry&process=' + id + '&autoInstantiate=false&mode=form');
                        } else {
                            url = $sce.trustAsResourceUrl(bonitaConfig.getBonitaUrl() + '/portal/homepage?ui=form&locale=en&tenant=1#form=' + processName + '--' + processVersion + '--' + taskName +'$entry&task=' + id + '&mode=form&assignTask=true');
                        }
                        return url;
                    };
                }],
                size: 'lg'
            });
            dialog.result.finally(function() {
                $scope.quickdetails.teamtasksPagination.refresh = !$scope.quickdetails.teamtasksPagination.refresh;
            });
        };

    }]);

/*
* PAGINATED LIST CONTROLLERS
*/

// User available tasks list controller
appModule.controller('TaskListController', 
	['$scope', '$modal', 'HumanTask', 
	function ($scope, $modal, HumanTask) {
	
	this.list = {items : [], pageIndex : 0, pageSize : 5, totalCount : 0};
	var controller = this;
	
	this.refresh = function() {
		controller.list.items = [];
		HumanTask.getFromCurrentUser({p : controller.list.pageIndex, c : controller.list.pageSize, d : 'rootContainerId'}).$promise.then(function (taskList) {
			// Update this list
			controller.list = taskList;
			// Update parent for stats
			$scope.$parent.totalTasksToDo = taskList.totalCount;
		});
	};
	
	// Global refresh signal listener - Used to init data
	$scope.$on('refresh_list', function(event) {
		controller.refresh();
	});
	
	// Common methods
	this.getCountLabel = function()		{	return getCountLabel(controller);	};
	this.hasPreviousPage = function()	{	return hasPreviousPage(controller);	}
	this.hasNextPage = function()		{	return hasNextPage(controller);	}
	this.showPreviousPage = function()	{	showPreviousPage(controller);	}
	this.showNextPage = function()		{	showNextPage(controller);	}
	this.getItems = function()			{	return getItems(controller);	};
}]);

// User app list controller
appModule.controller('AppListController', 
	['$scope', '$modal', 'ProcessDefinition', 
	function ($scope, $modal, ProcessDefinition) {
	
	this.list = {items : [], pageIndex : 0, pageSize : 5, totalCount : 0};
	var controller = this;
	
	this.refresh = function() {
		controller.list.items = [];
		ProcessDefinition.getStartableByCurrentUser({p : controller.list.pageIndex, c : controller.list.pageSize, d : 'deployedBy'}).$promise.then(function(appList) {
			// Update this list
			controller.list = appList;
			// Update parent for stats
			$scope.$parent.totalAppsAvailable = appList.totalCount;
		});
	};
	
	// Global refresh signal listener - Used to init data
	$scope.$on('refresh_list', function(event) {
		controller.refresh();
	});
	
	// Common methods
	this.getCountLabel = function()		{	return getCountLabel(controller);	};
	this.hasPreviousPage = function()	{	return hasPreviousPage(controller);	}
	this.hasNextPage = function()		{	return hasNextPage(controller);	}
	this.showPreviousPage = function()	{	showPreviousPage(controller);	}
	this.showNextPage = function()		{	showNextPage(controller);	}
	this.getItems = function()			{	return getItems(controller);	};
}]);

// User case list controller
appModule.controller('CaseListController', 
	['$scope', '$modal', 'ProcessInstance', 
	function ($scope, $modal, ProcessInstance) {
	
	this.list = {items : [], pageIndex : 0, pageSize : 5, totalCount : 0};
	var controller = this;
	
	this.refresh = function() {
		controller.list.items = [];
		ProcessInstance.getStartedByCurrentUser({p : controller.list.pageIndex, c : controller.list.pageSize, d : 'processDefinitionId'}).$promise.then(function(caseList) {
			// Update this list
			controller.list = caseList;
			// Update parent for stats
			$scope.$parent.totalCasesOpen = caseList.totalCount;
		});
	};
	
	// Global refresh signal listener - Used to init data
	$scope.$on('refresh_list', function(event) {
		controller.refresh();
	});
	
	// Common methods
	this.getCountLabel = function()		{	return getCountLabel(controller);	};
	this.hasPreviousPage = function()	{	return hasPreviousPage(controller);	}
	this.hasNextPage = function()		{	return hasNextPage(controller);	}
	this.showPreviousPage = function()	{	showPreviousPage(controller);	}
	this.showNextPage = function()		{	showNextPage(controller);	}
	this.getItems = function()			{	return getItems(controller);	};
}]);


// Common list methods definitions
function getCountLabel(controller) {
	if (!controller.list.items)
		return '';
		
	var startIndex = controller.list.pageIndex * controller.list.pageSize;
	var endIndex = startIndex + controller.list.pageSize;
	if (endIndex > controller.list.totalCount)
		endIndex = controller.list.totalCount;
	return 'Showing from '+ (startIndex+1) +' to '+ endIndex +' out of '+ controller.list.totalCount;
}

function hasPreviousPage(controller) {
	return controller.list.pageIndex > 0;
}

function hasNextPage(controller) {
	var startIndex = controller.list.pageIndex * controller.list.pageSize;
	var endIndex = startIndex + controller.list.pageSize;
	if (endIndex > controller.list.totalCount)
		endIndex = controller.list.totalCount;
	return endIndex < controller.list.totalCount;
}

function showPreviousPage(controller) {
	controller.list.pageIndex --;
	controller.refresh();
}

function showNextPage(controller) {
	controller.list.pageIndex ++;
	controller.refresh();
}

function getItems(controller) {
	return controller.list.items;
}

/*
* DASHBOARD PANE DIRECTIVES
*/

// User stats
appModule.directive("userStats", ['RESOURCE_PATH', function(RESOURCE_PATH) {
	return {
		restrict: 'E',
		templateUrl: RESOURCE_PATH +'directives/user-stats.html'
	};
}]);

// User apps
appModule.directive("userApps", ['RESOURCE_PATH', function(RESOURCE_PATH) {
	return {
		restrict: 'E',
		templateUrl: RESOURCE_PATH +'directives/user-apps.html'
	};
}]);

// User available tasks
appModule.directive("userAvailableTasks", ['RESOURCE_PATH', function(RESOURCE_PATH) {
	return {
		restrict: 'E',
		templateUrl: RESOURCE_PATH +'directives/user-available-tasks.html'
	};
}]);

// User's open cases
appModule.directive("userOpenCases", ['RESOURCE_PATH', function(RESOURCE_PATH) {
	return {
		restrict: 'E',
		templateUrl: RESOURCE_PATH +'directives/user-open-cases.html'
	};
}]);

// Pagination controls directive
appModule.directive("paginationContainer", ['RESOURCE_PATH', function(RESOURCE_PATH) {
	return {
		restrict: 'E',
		templateUrl: RESOURCE_PATH +'directives/pagination-container.html'
	};
}]);


})();