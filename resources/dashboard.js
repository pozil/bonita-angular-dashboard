'use strict';
/**
 * Copyright (C) 2014 BonitaSoft S.A.
 * BonitaSoft, 32 rue Gustave Eiffel - 38000 Grenoble
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
/**
 * Based on Fabio Lombardi's (Bonitasoft) original work
 * Edited by Philippe Ozil (Bonitasoft)
 */
 
(function() {

var appModule = angular.module('dashboard', ['ngCookies', 'ui.bootstrap', 'ngBonita']);

// Constant used to specify resource base path (facilitates integration into a Bonita custom page)
appModule.constant('RESOURCE_PATH', 'pageResource?page=custompage_angulardashboard&location=');

appModule.controller('dashboardController', 
	['$scope', '$cookies', '$modal', 'RESOURCE_PATH', 'BonitaSession', 'User', 'HumanTask', 'ArchivedHumanTask', 'ProcessDefinition', 'ProcessInstance', 'ArchivedProcessInstance', 
	function ($scope, $cookies, $modal, RESOURCE_PATH, BonitaSession, User, HumanTask, ArchivedHumanTask, ProcessDefinition, ProcessInstance, ArchivedProcessInstance) {
	
		// Prepare scope
        $scope.showRest = [];
        $scope.loggedUser = null;
        $scope.totalTasksToDo = null;
        $scope.totalArchivedTasksToDo = null;
        $scope.totalAppsAvailable = null;
        $scope.totalCasesOpen = null;
        $scope.totalArchivedCase = null;
        $scope.firstname = null;
        $scope.lastname = null;

		// Load data using ngBonita resources
        BonitaSession.getCurrent().$promise.then(function(session){
            $cookies.bonitaUserId	= session.user_id;
			$scope.loggedUser = session.user_id;
            // Load user data
			User.get({
                id:session.user_id
            }).$promise.then(function(user) {
                $scope.firstname = user.firstname;
                $scope.lastname = user.lastname;
            });
			// Load open tasks
            HumanTask.getFromCurrentUser({
                p:0,
                c:5,
				d:'rootContainerId'
            }).$promise.then(function(tasks) {
                $scope.tasks = tasks.items;
                $scope.totalTasksToDo = tasks.totalCount;
            });
			// Load archived tasks
            ArchivedHumanTask.getCompletedByCurrentUser({
                p:0,
                c:5,
				d:'rootContainerId'
            }).$promise.then(function(archivedTasks) {
                    $scope.archivedTasks = archivedTasks.items;
                    $scope.totalArchivedTasks = archivedTasks.totalCount;
            });
			// Load apps
            ProcessDefinition.getStartableByCurrentUser({
                p:0,
                c:5,
                d:'deployedBy'
            }).$promise.then(function(apps) {
                $scope.apps = apps.items;
                $scope.totalAppsAvailable = apps.totalCount;
            });
			// Load cases
            ProcessInstance.getStartedByCurrentUser({
                p:0,
                c:5,
                d:'processDefinitionId'
            }).$promise.then(function(cases) {
                    $scope.cases = cases.items;
                    $scope.totalCasesOpen = cases.totalCount;
            });
			// Load archived cases
            ArchivedProcessInstance.getStartedByCurrentUser({
                p:0,
                c:5,
                d:'processDefinitionId'
            }).$promise.then(function(archivedCases) {
                    $scope.archivedCases = archivedCases.items;
                    $scope.totalArchivedCases = archivedCases.totalCount;
            });
        });

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
                controller:  ['$scope', '$modalInstance', '$sce', 'BonitaAuthentication', function ($scope, $modalInstance, $sce, BonitaAuthentication) {
                    $scope.cancel = function () {
                        $modalInstance.dismiss('cancel');
                    };
                    $scope.getUrl = function () {
                        var url = null;
                        if (operationType == "startApp") {
                            url = $sce.trustAsResourceUrl(BonitaAuthentication.getBonitaUrl() + '/portal/homepage?ui=form&locale=en&tenant=1#form=' + processName + '--' + processVersion + '$entry&process=' + id + '&autoInstantiate=false&mode=form');
                        } else {
                            url = $sce.trustAsResourceUrl(BonitaAuthentication.getBonitaUrl() + '/portal/homepage?ui=form&locale=en&tenant=1#form=' + processName + '--' + processVersion + '--' + taskName +'$entry&task=' + id + '&mode=form&assignTask=true');
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
* DIRECTIVES
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



})();