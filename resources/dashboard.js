'use strict';
/**
 * Based on Fabio Lombardi's original work
 * Edited by Philippe Ozil
 * Project page: https://github.com/pozil/bonita-angular-dashboard
 */

(function() {

var appModule = angular.module('dashboardModule', ['ui.bootstrap', 'ngBonita']);

appModule.config(function (bonitaConfigProvider) {
    bonitaConfigProvider.setBonitaUrl('/bonita');
});

// Constant object storing application static configuration (see documentation)
appModule.constant('APP_CONFIG', {
	// Allows to switch between server or client side pagination
	'HAS_SERVER_SIDE_PAGINATION' : false,
	// Resource base path (facilitates integration into a Bonita custom page)
	'RESOURCE_PATH' : 'pageResource?page=custompage_angulardashboard&location=',
	// Max page size for listings in UI
	'UI_PAGE_SIZE' : 5,
	// Max server query result size when client side pagination is active
	'CLIENT_SIDE_MAX_SERVER_RESULTS' : 1000
});

appModule.controller('DashboardController', 
	['$scope', '$modal', 'APP_CONFIG', 'bonitaConfig', 'BonitaSession', 'User', 'ArchivedHumanTask', 'ArchivedProcessInstance', 
	function ($scope, $modal, APP_CONFIG, bonitaConfig, BonitaSession, User, ArchivedHumanTask, ArchivedProcessInstance) {
	
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
			User.get({id:session.user_id}).$promise.then(function(user) {
                $scope.user = user;
            });
			// Load archived tasks for stats
            ArchivedHumanTask.getCompletedByCurrentUser({p:0, c:1}).$promise.then(function(archivedTasks) {
				$scope.totalArchivedTasks = archivedTasks.totalCount;
            });
			// Load archived cases for stats
            ArchivedProcessInstance.getStartedByCurrentUser({p:0, c:1}).$promise.then(function(archivedCases) {
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

        $scope.getDate = function(dateString) {
		   return dateString.substring(0, dateString.lastIndexOf('.'));
        }

		// Modal dialog that displays REST documentation
        $scope.openRestModal = function(url) {
            var modalInstance = $modal.open({
                templateUrl: APP_CONFIG.RESOURCE_PATH +'directives/modal/' + url,
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
                templateUrl: APP_CONFIG.RESOURCE_PATH +'directives/modal/start-process.html',
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
	['APP_CONFIG', '$scope', '$filter', '$modal', 'HumanTask', 
	function (APP_CONFIG, $scope, $filter, $modal, HumanTask) {
	
	var orderByFilterFunction = null;
	var textFilterFunction = null;
	
	this.list = {items : [], pageIndex : 0, pageSize : 0, totalCount : 0};
	this.filterText = null;
	this.sortColumn = null;
	this.isDescendingSort = false;
	this.tableHeaders = [
		{ name: 'displayName',	label : 'Task name',	isSortable : true},
		{ name: 'procDefName',	label : 'App name',		isSortable : true},
		{ name: 'dueDate',		label : 'Due date',		isSortable : true},
		{ name: 'doIt',			label : 'Do it',		isSortable : false}
	];
	
	if (APP_CONFIG.HAS_SERVER_SIDE_PAGINATION)
	{
		// Disable sorting for server side pagination
		for (var i=0; i<this.tableHeaders.length; i++)
			this.tableHeaders[i].isSortable = false;
	}
	else // Client side pagination
	{
		// Prepare listing filters
		orderByFilterFunction = $filter('orderBy');
		textFilterFunction = $filter('filter');
	}
	
	var controller = this;
	
	this.updateView = function(forceDataRefresh) {
		// Prevent data reloading for client side pagination when navigating between pages
		if (!APP_CONFIG.HAS_SERVER_SIDE_PAGINATION && !forceDataRefresh)
			return;
		// Reset displayed data
		controller.filterText = null;
		controller.sortColumn = null;
		controller.isDescendingSort = false;
		controller.list.items = [];
		// Query new data
		var pageSize = (APP_CONFIG.HAS_SERVER_SIDE_PAGINATION) ? APP_CONFIG.UI_PAGE_SIZE : APP_CONFIG.CLIENT_SIDE_MAX_SERVER_RESULTS;
		HumanTask.getFromCurrentUser({p : controller.list.pageIndex, c : pageSize, d : 'rootContainerId'}).$promise.then(function (taskList) {
			// Transform list (for sorting/filtering)
			for (var i=0; i<taskList.items.length; i++)
				taskList.items[i].procDefName = taskList.items[i].rootContainerId.displayName;
			// Save updated list
			controller.list = taskList;
			// Update parent for stats
			$scope.$parent.totalTasksToDo = taskList.totalCount;
			// Update list stats for client side pagination
			if (!APP_CONFIG.HAS_SERVER_SIDE_PAGINATION)
			{
				controller.list.pageSize = APP_CONFIG.UI_PAGE_SIZE;
				controller.list.totalCount = controller.list.items.length;
			}
		});
	};
		
	// Global refresh signal listener - Used to init data
	$scope.$on('refresh_list', function(event) {
		controller.updateView(true);
	});
	
	// Client side common pagination methods
	this.getHeader = function(name)				{	return getHeader(controller, name);	};
	this.orderBy = function(tableHeader)		{	orderBy(controller, tableHeader, orderByFilterFunction);	};
	this.getHeaderClass = function(tableHeader) {	return getHeaderClass(controller, tableHeader);	};
	this.getCellClass = function(colName)		{	return getCellClass(controller, colName);	};
	// Common pagination methods
	this.isFilterDisplayed = function()	{	return isFilterDisplayed(APP_CONFIG);	}
	this.getCountLabel = function()		{	return getCountLabel(controller);	};
	this.hasPreviousPage = function()	{	return hasPreviousPage(controller);	}
	this.hasNextPage = function()		{	return hasNextPage(controller);	}
	this.showPreviousPage = function()	{	showPreviousPage(controller);	}
	this.showNextPage = function()		{	showNextPage(controller);	}
	this.getFilteredAndSortedList = function()	{	return getFilteredAndSortedList(controller, APP_CONFIG, textFilterFunction, $scope.filterText);	};
}]);

// User app list controller
appModule.controller('AppListController', 
	['APP_CONFIG', '$scope', '$filter', '$modal', 'ProcessDefinition', 
	function (APP_CONFIG, $scope, $filter, $modal, ProcessDefinition) {
	
	var orderByFilterFunction = null;
	var textFilterFunction = null;
	
	this.list = {items : [], pageIndex : 0, pageSize : 0, totalCount : 0};
	this.filterText = null;
	this.sortColumn = null;
	this.isDescendingSort = false;
	this.tableHeaders = [
		{ name: 'displayName',	label : 'Name',		isSortable : true},
		{ name: 'version',		label : 'Version',		isSortable : true},
		{ name: 'deployedBy',	label : 'Deployed by',	isSortable : true},
		{ name: 'startIt',		label : 'Start it',		isSortable : false}
	];
	
	if (APP_CONFIG.HAS_SERVER_SIDE_PAGINATION)
	{
		// Disable sorting for server side pagination
		for (var i=0; i<this.tableHeaders.length; i++)
			this.tableHeaders[i].isSortable = false;
	}
	else // Client side pagination
	{
		// Prepare listing filters
		orderByFilterFunction = $filter('orderBy');
		textFilterFunction = $filter('filter');
	}
	
	var controller = this;
	
	this.updateView = function(forceDataRefresh) {
		// Prevent data reloading for client side pagination when navigating between pages
		if (!APP_CONFIG.HAS_SERVER_SIDE_PAGINATION && !forceDataRefresh)
			return;
		// Reset displayed data
		controller.filterText = null;
		controller.sortColumn = null;
		controller.isDescendingSort = false;
		controller.list.items = [];
		// Query new data
		var pageSize = (APP_CONFIG.HAS_SERVER_SIDE_PAGINATION) ? APP_CONFIG.UI_PAGE_SIZE : APP_CONFIG.CLIENT_SIDE_MAX_SERVER_RESULTS;
		ProcessDefinition.getStartableByCurrentUser({p : controller.list.pageIndex, c : pageSize, d : 'deployedBy'}).$promise.then(function(appList) {
			// Transform list (for sorting/filtering)
			for (var i=0; i<appList.items.length; i++)
				appList.items[i].deployedByUserLabel = appList.items[i].deployedBy.firstname +' '+ appList.items[i].deployedBy.lastname;
			// Save updated list
			controller.list = appList;
			// Update parent for stats
			$scope.$parent.totalAppsAvailable = appList.totalCount;
			// Update list stats for client side pagination
			if (!APP_CONFIG.HAS_SERVER_SIDE_PAGINATION)
			{
				controller.list.pageSize = APP_CONFIG.UI_PAGE_SIZE;
				controller.list.totalCount = controller.list.items.length;
			}
		});
	};
	
	// Global refresh signal listener - Used to init data
	$scope.$on('refresh_list', function(event) {
		controller.updateView(true);
	});
	
	// Client side common pagination methods
	this.getHeader = function(name)				{	return getHeader(controller, name);	};
	this.orderBy = function(tableHeader)		{	orderBy(controller, tableHeader, orderByFilterFunction);	};
	this.getHeaderClass = function(tableHeader) {	return getHeaderClass(controller, tableHeader);	};
	this.getCellClass = function(colName)		{	return getCellClass(controller, colName);	};
	// Common pagination methods
	this.isFilterDisplayed = function()	{	return isFilterDisplayed(APP_CONFIG);	}
	this.getCountLabel = function()		{	return getCountLabel(controller);	};
	this.hasPreviousPage = function()	{	return hasPreviousPage(controller);	}
	this.hasNextPage = function()		{	return hasNextPage(controller);	}
	this.showPreviousPage = function()	{	showPreviousPage(controller);	}
	this.showNextPage = function()		{	showNextPage(controller);	}
	this.getFilteredAndSortedList = function()	{	return getFilteredAndSortedList(controller, APP_CONFIG, textFilterFunction, $scope.filterText);	};
}]);

// User case list controller
appModule.controller('CaseListController', 
	['APP_CONFIG', '$scope', '$filter', '$modal', 'ProcessInstance', 
	function (APP_CONFIG, $scope, $filter, $modal, ProcessInstance) {
	
	var orderByFilterFunction = null;
	var textFilterFunction = null;
	
	this.list = {items : [], pageIndex : 0, pageSize : 0, totalCount : 0};
	this.filterText = null;
	this.sortColumn = null;
	this.isDescendingSort = false;
	this.tableHeaders = [
		{ name: 'id',				label : 'Case Id',		isSortable : true},
		{ name: 'procDefName',		label : 'App name',		isSortable : true},
		{ name: 'procDefVersion',	label : 'App ver.',	isSortable : true},
		{ name: 'start',			label : 'Started on',	isSortable : true}
	];
	
	if (APP_CONFIG.HAS_SERVER_SIDE_PAGINATION)
	{
		// Disable sorting for server side pagination
		for (var i=0; i<this.tableHeaders.length; i++)
			this.tableHeaders[i].isSortable = false;
	}
	else // Client side pagination
	{
		// Prepare listing filters
		orderByFilterFunction = $filter('orderBy');
		textFilterFunction = $filter('filter');
	}
	
	var controller = this;
	
	this.updateView = function(forceDataRefresh) {
		// Prevent data reloading for client side pagination when navigating between pages
		if (!APP_CONFIG.HAS_SERVER_SIDE_PAGINATION && !forceDataRefresh)
			return;
		// Reset displayed data
		controller.filterText = null;
		controller.sortColumn = null;
		controller.isDescendingSort = false;
		controller.list.items = [];
		// Query new data
		var pageSize = (APP_CONFIG.HAS_SERVER_SIDE_PAGINATION) ? APP_CONFIG.UI_PAGE_SIZE : APP_CONFIG.CLIENT_SIDE_MAX_SERVER_RESULTS;
		ProcessInstance.getStartedByCurrentUser({p : controller.list.pageIndex, c : pageSize, d : 'processDefinitionId'}).$promise.then(function(caseList) {
			// Transform list (for sorting/filtering)
			for (var i=0; i<caseList.items.length; i++)
			{
				var item = caseList.items[i];
				item.procDefName = item.processDefinitionId.displayName;
				item.procDefVersion = item.processDefinitionId.version;
			}
			// Save updated list
			controller.list = caseList;
			// Update parent for stats
			$scope.$parent.totalCasesOpen = caseList.totalCount;
			// Update list stats for client side pagination
			if (!APP_CONFIG.HAS_SERVER_SIDE_PAGINATION)
			{
				controller.list.pageSize = APP_CONFIG.UI_PAGE_SIZE;
				controller.list.totalCount = controller.list.items.length;
			}
		});
	};
	
	// Global refresh signal listener - Used to init data
	$scope.$on('refresh_list', function(event) {
		controller.updateView(true);
	});
	
	// Client side common pagination methods
	this.getHeader = function(name)				{	return getHeader(controller, name);	};
	this.orderBy = function(tableHeader)		{	orderBy(controller, tableHeader, orderByFilterFunction);	};
	this.getHeaderClass = function(tableHeader) {	return getHeaderClass(controller, tableHeader);	};
	this.getCellClass = function(colName)		{	return getCellClass(controller, colName);	};
	// Common pagination methods
	this.isFilterDisplayed = function()	{	return isFilterDisplayed(APP_CONFIG);	}
	this.getCountLabel = function()		{	return getCountLabel(controller);	};
	this.hasPreviousPage = function()	{	return hasPreviousPage(controller);	}
	this.hasNextPage = function()		{	return hasNextPage(controller);	}
	this.showPreviousPage = function()	{	showPreviousPage(controller);	}
	this.showNextPage = function()		{	showNextPage(controller);	}
	this.getFilteredAndSortedList = function()	{	return getFilteredAndSortedList(controller, APP_CONFIG, textFilterFunction, $scope.filterText);	};
}]);


/*
* CLIENT SIDE COMMON PAGINATION METHODS DEFINITIONS
*/
function getCellClass(controller, colName) {
	return (controller.sortColumn === colName) ? 'sorted' : 'unsorted';
};

function getHeaderClass(controller, tableHeader) {
	if (tableHeader.isSortable)
	{
		if (controller.sortColumn === tableHeader.name)
			return (controller.isDescendingSort) ? 'sort_desc' : 'sort_asc';
		else
			return 'unsorted';
	}
	else
		return 'unsortable';
};

function getHeader(controller, name) {
	var header = null;
	for (var i=0; header === null && i < controller.tableHeaders.length; i++)
	{
		if (controller.tableHeaders[i].name == name)
			header = controller.tableHeaders[i];
	}
	return header;
};

function orderBy(controller, tableHeader, orderByFilter) {
	// Check if column is sortable
	if (!tableHeader.isSortable)
		return;
	// Sort
	controller.isDescendingSort = (controller.sortColumn === tableHeader.name) ? !controller.isDescendingSort : false;
	controller.sortColumn = tableHeader.name;
	controller.list.items = orderByFilter(controller.list.items, controller.sortColumn, controller.isDescendingSort);
}

/*
* COMMON PAGINATION METHODS DEFINITIONS
*/
function isFilterDisplayed(APP_CONFIG) {
	return !APP_CONFIG.HAS_SERVER_SIDE_PAGINATION;
}

function getCountLabel(controller) {
	if (!controller.list.items)
		return '';
	if (controller.list.totalCount === 0)
		return 'No result';
	
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
	controller.updateView(false);
}

function showNextPage(controller) {
	controller.list.pageIndex ++;
	controller.updateView(false);
}

function getItems(controller) {
	return controller.list.items;
}

function getFilteredAndSortedList(controller, APP_CONFIG, textFilterFunction, textFilterValue)
{
	if (APP_CONFIG.HAS_SERVER_SIDE_PAGINATION)
		return controller.list.items;
	else // Client side pagination
	{
		// Apply text filter if needed
		var sortedAndFilteredList = textFilterFunction(controller.list.items, textFilterValue);
		// Update total count for pagination
		controller.list.totalCount = sortedAndFilteredList.length;
		// Force list pagination
		var startIndex = controller.list.pageIndex * APP_CONFIG.UI_PAGE_SIZE;
		return sortedAndFilteredList.slice(startIndex, startIndex + APP_CONFIG.UI_PAGE_SIZE);
	}
}

/*
* DASHBOARD PANE DIRECTIVES
*/

// User stats
appModule.directive("userStats", ['APP_CONFIG', function(APP_CONFIG) {
	return {
		restrict: 'E',
		templateUrl: APP_CONFIG.RESOURCE_PATH +'directives/user-stats.html'
	};
}]);

// User apps
appModule.directive("userApps", ['APP_CONFIG', function(APP_CONFIG) {
	return {
		restrict: 'E',
		templateUrl: APP_CONFIG.RESOURCE_PATH +'directives/user-apps.html'
	};
}]);

// User available tasks
appModule.directive("userAvailableTasks", ['APP_CONFIG', function(APP_CONFIG) {
	return {
		restrict: 'E',
		templateUrl: APP_CONFIG.RESOURCE_PATH +'directives/user-available-tasks.html'
	};
}]);

// User's open cases
appModule.directive("userOpenCases", ['APP_CONFIG', function(APP_CONFIG) {
	return {
		restrict: 'E',
		templateUrl: APP_CONFIG.RESOURCE_PATH +'directives/user-open-cases.html'
	};
}]);

// Pagination controls directive
appModule.directive("paginationContainer", ['APP_CONFIG', function(APP_CONFIG) {
	return {
		restrict: 'E',
		templateUrl: APP_CONFIG.RESOURCE_PATH +'directives/pagination-container.html'
	};
}]);


})();