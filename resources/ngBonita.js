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
 * This module provides easy access to Bonita BPM REST APIs
 *
 * @author Philippe Ozil
 * @author Rodrigue Le Gall
 */
(function() {
	var app = angular.module('ngBonita', ['ngResource', 'ngCookies']);
	
	app.run(function ($cookies){
		// Init cookie that stores Bonita URL - Default: Bonita on local host
		$cookies.bonitaUrl = 'http://localhost:8080/bonita';
	});
	
	/**
	* Factory that manages Bonita authentication
	*/	
	app.factory('BonitaAuthentication', ['$log', '$http', '$cookies', '$q', 'BonitaSession', function($log, $http, $cookies, $q, BonitaSession){
	
		var bonitaAuthentication = {};
        
        /**
         * Configure the Bonita application URL (must include application name without trailing slash)
         * @param url
         */
        bonitaAuthentication.setBonitaUrl = function(url){
            $cookies.bonitaUrl = url;
        };
		
		/**
         * Gets the Bonita application URL
         * @param url
         */
        bonitaAuthentication.getBonitaUrl = function(){
            return $cookies.bonitaUrl;
        };
		
		/**
		* Retrieves the currently logged Bonita user id
		* @return logged Bonita user id
		*/
		bonitaAuthentication.getUserId = function(){
			return $cookies.bonitaUserId;
		};
		
		/**
		* Retrieves the currently logged Bonita user name
		* @return logged Bonita user name
		*/
		bonitaAuthentication.getUsername = function(){
			return $cookies.bonitaUsername;
		};
		
		/**
		* Performs a Bonita login
		* @param username
		* @param password
		*/
		bonitaAuthentication.login = function(username, password)
		{
			var deferred = $q.defer();
		
			$http({
				method: 'POST',
				url: $cookies.bonitaUrl +'/loginservice',
				data: $.param({username : username, password : password, redirect : false}),
				headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}
			}).success(function (data) {
				$log.log('BonitaAuthentication.login success');
				// Retrieve current session to get user id
				BonitaSession.getCurrent().$promise.then(function (session) {
					if (session == null)
						deferred.reject('No active session found');
					else
					{
						// Save basic session data
						$cookies.bonitaUsername	= session.user_name;
						$cookies.bonitaUserId	= session.user_id;
						deferred.resolve(session);
					}
				});
			}).error(function (data, status, headers, config) {
				$log.log('BonitaAuthentication.login failure response '+ status);
				$log.log('Bonita URL: '+ $cookies.bonitaUrl);
				deferred.reject({data: data, status: status, headers: headers, config: config});
			});
			
			return deferred.promise;
		};
		
		/**
		* Performs a Bonita logout
		*/
		bonitaAuthentication.logout = function()
		{
			var deferred = $q.defer();
			
			$http({
				method: 'GET',
				url: $cookies.bonitaUrl +'/logoutservice',
				data: $.param({redirect : false}),
				headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}
			}).success(function () {
				$log.log('BonitaAuthentication.logout success');
				deferred.resolve();
			}).error(function (data, status, headers, config) {
				$log.log('BonitaAuthentication.logout failure response '+ status);
				deferred.reject({data: data, status: status, headers: headers, config: config});
			});
			
			return deferred.promise;
		};
		
		return bonitaAuthentication;
	}]);
	
	/**
	* Resource used to access Bonita session information
	*/
	app.factory('BonitaSession', ['$resource', '$cookies', function($resource, $cookies){
		return $resource($cookies.bonitaUrl +'/API/system/session/unused', {},
			{
				getCurrent : {method:'GET'}
			}
		);
	}]);
	
	/**
	* Resource used to access Bonita users
	*/
	app.factory('User', ['$resource', '$cookies', function($resource, $cookies){
		return $resource($cookies.bonitaUrl +'/API/identity/user/:id', {id:'@id'});
	}]);
	
	/**
	* Resource used to access Bonita human tasks instances
	*/
	app.factory('HumanTask', ['$resource', '$http', '$cookies', function($resource, $http, $cookies){
		return $resource($cookies.bonitaUrl +'/API/bpm/humanTask/:id', {id:'@id', p:0, c:10, o:'priority ASC'},
			{
				getFromCurrentUser : {
					method:'GET',
					params:{f : ['state=ready', 'user_id='+ $cookies.bonitaUserId]},
					transformResponse:	[paginateResponse].concat($http.defaults.transformResponse)
				}
			}
		);
	}]);
	
	/**
	* Resource used to access Bonita archived human tasks instances
	*/
	app.factory('ArchivedHumanTask', ['$resource', '$http', '$cookies', function($resource, $http, $cookies){
		return $resource($cookies.bonitaUrl +'/API/bpm/archivedHumanTask/:id', {id:'@id', p:0, c:10, o:'reached_state_date ASC'},
			{
				getCompletedByCurrentUser : {
					method:'GET',
					params:{f : ['assigned_id='+ $cookies.bonitaUserId]},
					transformResponse:	[paginateResponse].concat($http.defaults.transformResponse)
				}
			}
		);
	}]);
	
	/**
	* Resource used to access Bonita process instances (cases)
	*/
	app.factory('ProcessInstance', ['$resource', '$http', '$cookies', function($resource, $http, $cookies){
		return $resource($cookies.bonitaUrl +'/API/bpm/case/:id', {id:'@id', p:0, c:10},
			{
				getStartedByCurrentUser : {
					method:'GET',
					params:{f : ['started_by='+ $cookies.bonitaUserId]},
					transformResponse:	[paginateResponse].concat($http.defaults.transformResponse)
				}
			}
		);
	}]);
	
	/**
	* Resource used to access Bonita archived process instances (cases)
	*/
	app.factory('ArchivedProcessInstance', ['$resource', '$http', '$cookies', function($resource, $http, $cookies){
		return $resource($cookies.bonitaUrl +'/API/bpm/archivedCase/:id', {id:'@id', p:0, c:10},
			{
				getStartedByCurrentUser : {
					method:'GET',
					params:{f : ['started_by='+ $cookies.bonitaUserId]},
					transformResponse:	[paginateResponse].concat($http.defaults.transformResponse)
				}
			}
		);
	}]);
	
	/**
	* Resource used to access Bonita process definition (apps)
	*/
	app.factory('ProcessDefinition', ['$resource', '$http', '$cookies', function($resource, $http, $cookies){
		return $resource($cookies.bonitaUrl +'/API/bpm/process/:id', {id:'@id', p:0, c:10, o:'displayName ASC'},
			{
				getStartableByCurrentUser : {
					method:	'GET',
					params:	{f : ['user_id='+ $cookies.bonitaUserId]},
					transformResponse:	[paginateResponse].concat($http.defaults.transformResponse)
				}
			}
		);
	}]);
	
	
	/**
	* Transforms an HTTP response in order to extract pagination information from header
	* @param data original response data
	* @param headersGetter method used to access response headers
	* @return transformed response object containing the following attributes {items, pageIndex, pageSize, totalCount}
	*/
	function paginateResponse(data, headersGetter)
	{
		// Parse pagination header
		var strContentRange = headersGetter()['content-range'];
		var arrayContentRange = strContentRange.split('/');
		var arrayIndexNumPerPage = arrayContentRange[0].split('-');
		// Assemble response data with pagination
		return {
			items :			angular.fromJson(data),
			pageIndex :		Number(arrayIndexNumPerPage[0]),
			pageSize :		Number(arrayIndexNumPerPage[1]),
			totalCount :	Number(arrayContentRange[1])
		};
	}
})();

