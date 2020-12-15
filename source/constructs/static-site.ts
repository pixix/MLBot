#!/usr/bin/env node
import cloudfront = require('@aws-cdk/aws-cloudfront');
import route53 = require('@aws-cdk/aws-route53');
import s3 = require('@aws-cdk/aws-s3');
import s3deploy = require('@aws-cdk/aws-s3-deployment');
// import acm = require('@aws-cdk/aws-certificatemanager');
import cdk = require('@aws-cdk/core');
import targets = require('@aws-cdk/aws-route53-targets/lib');
import { CloudFrontToS3 } from '@aws-solutions-constructs/aws-cloudfront-s3';
import { Construct } from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as path from 'path'

interface CustomResourceConfig {
  readonly properties?: { path: string, value: any }[];
  readonly condition?: cdk.CfnCondition;
  readonly dependencies?: cdk.CfnResource[];
}

export interface StaticSiteProps {
  domainName: string;
  siteSubDomain: string;
  apiUrl: string;
}

/**
 * Static site infrastructure, which deploys site content to an S3 bucket.
 *
 * The site redirects from HTTP to HTTPS, using a CloudFront distribution,
 * Route53 alias record, and ACM certificate.
 */
export class StaticSite extends Construct {
  constructor(parent: Construct, name: string, props: StaticSiteProps) {
    super(parent, name);

    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });
    const siteDomain = props.siteSubDomain + '.' + props.domainName;
    new cdk.CfnOutput(this, 'Site', { value: 'https://' + siteDomain });

    // Content bucket
    const website = new CloudFrontToS3(this, 'CloudFrontToS3', {
      bucketProps: {
        versioned: false,
        bucketName: siteDomain.replace(/\./g, '-'),
        websiteIndexDocument: 'index.html',
        websiteErrorDocument: 'error.html',
        serverAccessLogsBucket: undefined,
        accessControl: s3.BucketAccessControl.PRIVATE,
        // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
        // the new bucket, and it will remain in your account until manually deleted. By setting the policy to
        // DESTROY, cdk destroy will attempt to delete the bucket, but will error if the bucket is not empty.
        removalPolicy: cdk.RemovalPolicy.DESTROY // NOT recommended for production code
      },
      cloudFrontDistributionProps: {
        viewerCertificate: cloudfront.ViewerCertificate.fromCloudFrontDefaultCertificate(siteDomain),
        priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
        enableIpV6: false,
        loggingConfig: {},
      },
      insertHttpSecurityHeaders: false
    });

    const siteBucket = website.s3Bucket as s3.Bucket;
    new cdk.CfnOutput(this, 'Bucket', { value: siteBucket.bucketName });

    const distribution = website.cloudFrontWebDistribution as cloudfront.CloudFrontWebDistribution
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });

    //-------------------------------------------------------
    // Custom Resources
    //-------------------------------------------------------
    
    // CustomResourceRole
    const customResourceRole = new iam.Role(this, 'CustomResourceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      roleName: `${cdk.Aws.STACK_NAME}CustomResourceRole-${cdk.Aws.REGION}`
    })
    const cfnCustomResourceRole = customResourceRole.node.defaultChild as iam.CfnRole;
    cfnCustomResourceRole.overrideLogicalId('CustomResourceRole');

    // CustomResourcePolicy
    const customResourcePolicy = new iam.Policy(this, 'CustomResourcePolicy', {
      policyName: `${cdk.Aws.STACK_NAME}CustomResourcePolicy`,
      statements: [
        new iam.PolicyStatement({
          actions: [
            'logs:CreateLogStream',
            'logs:CreateLogGroup',
            'logs:PutLogEvents'
          ],
          resources: [
            `arn:${cdk.Aws.PARTITION}:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/*`
          ]
        }),
        new iam.PolicyStatement({
          actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
          resources: [`arn:${cdk.Aws.PARTITION}:s3:::*`]
        })
      ]
    });
    customResourcePolicy.attachToRole(customResourceRole);
    const cfnCustomResourcePolicy = customResourcePolicy.node.defaultChild as iam.CfnPolicy;
    cfnCustomResourcePolicy.overrideLogicalId('CustomResourcePolicy');

    const customResourceFunction = new lambda.Function(this, 'CustomHandler', {
      description: 'AWS ML Bot - Custom resource',
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: customResourceRole,
      code: lambda.Code.fromAsset(path.join(__dirname, '../custom-resource/'), {
        bundling: {
          image: lambda.Runtime.NODEJS_12_X.bundlingDockerImage,
          command: [
            'bash', '-c', [
              `cd /asset-output/`,
              `cp -r /asset-input/* /asset-output/`,
              `cd /asset-output/`,
              `npm install`
            ].join(' && ')
          ],
          user: 'root'
        }
      })
    })

    // CustomResourceConfig
    this.createCustomResource('CustomResourceConfig', customResourceFunction, {
      properties: [
        { path: 'Region', value: cdk.Aws.REGION },
        { path: 'destS3Bucket', value: siteBucket.bucketName },
        { path: 'destS3key', value: 'aws-exports.json' },
        { path: 'customAction', value: 'putConfigFile' },
        {
          path: 'configItem', value: {
            aws_project_region: cdk.Aws.REGION,
            apiUrl: props.apiUrl
          }
        }
      ],
      dependencies: [ cfnCustomResourceRole, cfnCustomResourcePolicy ]
    });

    // Route53 alias record for the CloudFront distribution
    new route53.ARecord(this, 'SiteAliasRecord', {
      recordName: siteDomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone
    });

    // Deploy site contents to S3 bucket
    new s3deploy.BucketDeployment(this, 'DeployWithInvalidation', {
      sources: [ s3deploy.Source.asset('./../portal/build') ],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      // disable this, otherwise the aws-exports.json will be deleted
      prune: false
    });
  }

  //-------------------------------------------------------
  // Custom Resources Functions
  //-------------------------------------------------------

  addDependencies(resource: cdk.CfnResource, dependencies: cdk.CfnResource[]) {
    for (let dependency of dependencies) {
      resource.addDependsOn(dependency);
    }
  }

  createCustomResource(id: string, customResourceFunction: lambda.Function, config?: CustomResourceConfig): cdk.CfnCustomResource {
    const customResource = new cdk.CfnCustomResource(this, id, {
      serviceToken: customResourceFunction.functionArn
    });
    customResource.addOverride('Type', 'Custom::CustomResource');
    customResource.overrideLogicalId(id);
    if (config) {
      const { properties, condition, dependencies } = config;
      if (properties) {
        for (let property of properties) {
          customResource.addPropertyOverride(property.path, property.value);
        }
      }
      if (dependencies) {
        this.addDependencies(customResource, dependencies);
      }
      customResource.cfnOptions.condition = condition;
    }
    return customResource;
  }

}
